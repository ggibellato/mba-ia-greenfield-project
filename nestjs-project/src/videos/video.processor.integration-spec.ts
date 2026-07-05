import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import databaseConfig from '../config/database.config';
import queueConfig from '../config/queue.config';
import storageConfig from '../config/storage.config';
import { User } from '../users/entities/user.entity';
import { cleanAllTables } from '../test/create-test-data-source';
import { Video, VideoStatus } from './entities/video.entity';
import { StorageService } from './storage.service';
import { VideoProcessor } from './video.processor';

const execFileAsync = promisify(execFile);

async function waitForStatus(
  repo: Repository<Video>,
  id: string,
  targetStatuses: VideoStatus[],
  timeoutMs = 20000,
): Promise<Video> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const video = await repo.findOneBy({ id });
    if (video && targetStatuses.includes(video.status)) {
      return video;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `Video ${id} did not reach status ${targetStatuses.join('/')} within ${timeoutMs}ms`,
  );
}

describe('VideoProcessor (integration, real MinIO + real Redis/BullMQ)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;
  let storageService: StorageService;
  let queue: Queue;
  let workDir: string;
  let processor: VideoProcessor;

  beforeAll(async () => {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-processor-test-'));

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, queueConfig, storageConfig],
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [databaseConfig.KEY],
          useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
            type: 'postgres',
            host: dbConfig.host,
            port: dbConfig.port,
            username: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.name,
            entities: [User, Channel, Video],
            synchronize: false,
          }),
        }),
        TypeOrmModule.forFeature([User, Channel, Video]),
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [queueConfig.KEY],
          useFactory: (qConfig: ConfigType<typeof queueConfig>) => ({
            connection: { host: qConfig.host, port: qConfig.port },
          }),
        }),
        BullModule.registerQueueAsync({
          name: 'video-processing',
          useFactory: () => ({}),
        }),
      ],
      providers: [StorageService, VideoProcessor],
    }).compile();

    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);
    storageService = moduleRef.get(StorageService);
    queue = moduleRef.get(getQueueToken('video-processing'));
    processor = moduleRef.get(VideoProcessor);
  });

  afterAll(async () => {
    await processor.worker.close();
    await queue.close();
    await dataSource.destroy();
    await fs.rm(workDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    await queue.obliterate({ force: true });
  });

  let counter = 0;
  async function createChannel(): Promise<Channel> {
    const n = ++counter;
    const user = await userRepository.save(
      userRepository.create({
        email: `worker_user_${n}@example.com`,
        password: 'hashed',
      }),
    );
    return channelRepository.save(
      channelRepository.create({
        name: `Worker Chan ${n}`,
        nickname: `worker_chan_${n}`,
        user_id: user.id,
      }),
    );
  }

  // 5s clip, red for the first 0.3s then green — lets the thumbnail's color prove it was grabbed at 10% (green), not timestamp 0 (red).
  async function generateTwoColorVideo(): Promise<string> {
    const filePath = path.join(workDir, `${randomUUID()}.mp4`);
    await execFileAsync('ffmpeg', [
      '-f',
      'lavfi',
      '-i',
      'color=c=red:s=64x64:d=0.3',
      '-f',
      'lavfi',
      '-i',
      'color=c=green:s=64x64:d=4.7',
      '-filter_complex',
      '[0:v][1:v]concat=n=2:v=1:a=0',
      '-pix_fmt',
      'yuv420p',
      '-y',
      filePath,
    ]);
    return filePath;
  }

  async function getPixelColor(
    imagePath: string,
  ): Promise<{ r: number; g: number; b: number }> {
    const { stdout } = await execFileAsync(
      'ffmpeg',
      [
        '-i',
        imagePath,
        '-vf',
        'scale=1:1',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        '-',
      ],
      { encoding: 'buffer' as BufferEncoding, maxBuffer: 1024 * 1024 },
    );
    const buf = stdout as unknown as Buffer;
    return { r: buf[0], g: buf[1], b: buf[2] };
  }

  it('processes a valid video: extracts duration, generates a thumbnail at 10%, and flips status to ready', async () => {
    const channel = await createChannel();
    const localPath = await generateTwoColorVideo();
    const storageKey = `videos/${randomUUID()}/original.mp4`;
    await storageService.uploadFile(storageKey, localPath, 'video/mp4');

    const video = await videoRepository.save(
      videoRepository.create({
        channel_id: channel.id,
        original_filename: 'sample.mp4',
        storage_key: storageKey,
        status: VideoStatus.PROCESSING,
      }),
    );

    await queue.add('process-video', { videoId: video.id });

    const updated = await waitForStatus(videoRepository, video.id, [
      VideoStatus.READY,
      VideoStatus.ERROR,
    ]);

    expect(updated.status).toBe(VideoStatus.READY);
    expect(updated.duration_seconds).toBeGreaterThanOrEqual(4);
    expect(updated.thumbnail_key).toBe(`videos/${video.id}/thumbnail.jpg`);

    const downloadedThumbnail = path.join(workDir, `${randomUUID()}.jpg`);
    await storageService.downloadToFile(
      updated.thumbnail_key!,
      downloadedThumbnail,
    );
    const color = await getPixelColor(downloadedThumbnail);
    // Green (10% mark, ~0.5s) not red (timestamp 0, first 0.3s).
    expect(color.g).toBeGreaterThan(color.r);
    expect(color.r).toBeLessThan(100);
  }, 30000);

  it('leaves the video in error status after a corrupt file exhausts retries', async () => {
    const channel = await createChannel();
    const storageKey = `videos/${randomUUID()}/original.mp4`;
    const garbagePath = path.join(workDir, `${randomUUID()}.mp4`);
    await fs.writeFile(garbagePath, 'this is not a video file');
    await storageService.uploadFile(storageKey, garbagePath, 'video/mp4');

    const video = await videoRepository.save(
      videoRepository.create({
        channel_id: channel.id,
        original_filename: 'corrupt.mp4',
        storage_key: storageKey,
        status: VideoStatus.PROCESSING,
      }),
    );

    await queue.add(
      'process-video',
      { videoId: video.id },
      { attempts: 2, backoff: { type: 'fixed', delay: 50 } },
    );

    const updated = await waitForStatus(videoRepository, video.id, [
      VideoStatus.READY,
      VideoStatus.ERROR,
    ]);

    expect(updated.status).toBe(VideoStatus.ERROR);
  }, 30000);
});
