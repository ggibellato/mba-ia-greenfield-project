import { DataSource, Repository } from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { User } from '../../users/entities/user.entity';
import {
  cleanAllTables,
  createTestDataSource,
} from '../../test/create-test-data-source';
import { ALL_ENTITIES } from '../../test/all-entities';
import { Video, VideoStatus } from './video.entity';

describe('Video entity (integration)', () => {
  let dataSource: DataSource;
  let userRepository: Repository<User>;
  let channelRepository: Repository<Channel>;
  let videoRepository: Repository<Video>;

  beforeAll(async () => {
    dataSource = createTestDataSource(ALL_ENTITIES);
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    channelRepository = dataSource.getRepository(Channel);
    videoRepository = dataSource.getRepository(Video);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  let counter = 0;
  async function createChannel(): Promise<Channel> {
    const n = ++counter;
    const user = await userRepository.save(
      userRepository.create({
        email: `video_user_${n}@example.com`,
        password: 'hashed',
      }),
    );
    return channelRepository.save(
      channelRepository.create({
        name: `Channel ${n}`,
        nickname: `video_chan_${n}`,
        user_id: user.id,
      }),
    );
  }

  function buildVideo(
    channelId: string,
    overrides: Partial<Video> = {},
  ): Partial<Video> {
    return {
      channel_id: channelId,
      original_filename: 'my-video.mp4',
      storage_key: 'videos/some-id/original.mp4',
      ...overrides,
    };
  }

  it('should persist a video with default status and retry_count', async () => {
    const channel = await createChannel();
    const video = await videoRepository.save(
      videoRepository.create(buildVideo(channel.id)),
    );

    expect(video.id).toBeDefined();
    expect(video.status).toBe(VideoStatus.DRAFT);
    expect(video.retry_count).toBe(0);
    expect(video.thumbnail_key).toBeNull();
    expect(video.duration_seconds).toBeNull();
    expect(video.upload_id).toBeNull();
    expect(video.created_at).toBeInstanceOf(Date);
    expect(video.updated_at).toBeInstanceOf(Date);
  });

  it('should reject an invalid enum value for status', async () => {
    const channel = await createChannel();
    const video = videoRepository.create(
      buildVideo(channel.id, { status: 'invalid_status' as VideoStatus }),
    );

    await expect(videoRepository.save(video)).rejects.toThrow();
  });

  it('should persist every valid status enum value', async () => {
    const channel = await createChannel();
    for (const status of Object.values(VideoStatus)) {
      const video = await videoRepository.save(
        videoRepository.create(buildVideo(channel.id, { status })),
      );
      expect(video.status).toBe(status);
    }
  });

  it('should reject a channel_id that does not reference an existing channel', async () => {
    const video = videoRepository.create(
      buildVideo('00000000-0000-0000-0000-000000000000'),
    );

    await expect(videoRepository.save(video)).rejects.toThrow();
  });

  it('should require original_filename', async () => {
    const channel = await createChannel();
    const video = videoRepository.create({
      channel_id: channel.id,
      storage_key: 'videos/some-id/original.mp4',
    });

    await expect(videoRepository.save(video)).rejects.toThrow();
  });

  it('should require storage_key', async () => {
    const channel = await createChannel();
    const video = videoRepository.create({
      channel_id: channel.id,
      original_filename: 'my-video.mp4',
    });

    await expect(videoRepository.save(video)).rejects.toThrow();
  });

  it('should persist non-null thumbnail_key, duration_seconds, and upload_id', async () => {
    const channel = await createChannel();
    const video = await videoRepository.save(
      videoRepository.create(
        buildVideo(channel.id, {
          thumbnail_key: 'videos/some-id/thumbnail.jpg',
          duration_seconds: 120,
          upload_id: 'minio-upload-id',
        }),
      ),
    );

    expect(video.thumbnail_key).toBe('videos/some-id/thumbnail.jpg');
    expect(video.duration_seconds).toBe(120);
    expect(video.upload_id).toBe('minio-upload-id');
  });

  it('should load the related channel via ManyToOne relation', async () => {
    const channel = await createChannel();
    const saved = await videoRepository.save(
      videoRepository.create(buildVideo(channel.id)),
    );

    const found = await videoRepository.findOne({
      where: { id: saved.id },
      relations: ['channel'],
    });

    expect(found?.channel.id).toBe(channel.id);
  });
});
