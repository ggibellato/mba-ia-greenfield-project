import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import ffmpeg from 'fluent-ffmpeg';
import { Repository } from 'typeorm';
import { Video, VideoStatus } from './entities/video.entity';
import { StorageService } from './storage.service';

interface ProcessVideoPayload {
  videoId: string;
}

const THUMBNAIL_TIMESTAMP = '10%';
const THUMBNAIL_FILENAME = 'thumbnail.jpg';

@Processor('video-processing')
export class VideoProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<ProcessVideoPayload>): Promise<void> {
    const video = await this.videoRepository.findOneBy({
      id: job.data.videoId,
    });
    if (!video) {
      return;
    }

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-'));
    const originalPath = path.join(
      workDir,
      `original${path.extname(video.storage_key)}`,
    );

    try {
      await this.storageService.downloadToFile(video.storage_key, originalPath);

      const durationSeconds = await this.extractDuration(originalPath);
      await this.generateThumbnail(originalPath, workDir);

      const thumbnailKey = `videos/${video.id}/thumbnail.jpg`;
      await this.storageService.uploadFile(
        thumbnailKey,
        path.join(workDir, THUMBNAIL_FILENAME),
        'image/jpeg',
      );

      video.duration_seconds = Math.round(durationSeconds);
      video.thumbnail_key = thumbnailKey;
      video.status = VideoStatus.READY;
      await this.videoRepository.save(video);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ProcessVideoPayload>): Promise<void> {
    const attemptsAllowed = job.opts.attempts ?? 1;
    if (job.attemptsMade < attemptsAllowed) {
      return;
    }
    await this.videoRepository.update(job.data.videoId, {
      status: VideoStatus.ERROR,
    });
  }

  private extractDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err as Error);
          return;
        }
        resolve(metadata.format.duration ?? 0);
      });
    });
  }

  private generateThumbnail(filePath: string, folder: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .screenshots({
          timestamps: [THUMBNAIL_TIMESTAMP],
          filename: THUMBNAIL_FILENAME,
          folder,
        })
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err));
    });
  }
}
