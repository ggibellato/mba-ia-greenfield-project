import { randomUUID } from 'crypto';
import { extname } from 'path';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelsService } from '../channels/channels.service';
import {
  VideoAccessForbiddenException,
  VideoNotFoundException,
  VideoNotInDraftException,
  VideoNotInErrorStateException,
} from '../common/exceptions/domain.exception';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { Video, VideoStatus } from './entities/video.entity';
import { StorageService } from './storage.service';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly storageService: StorageService,
    private readonly channelsService: ChannelsService,
    @InjectQueue('video-processing')
    private readonly videoProcessingQueue: Queue,
  ) {}

  async createVideo(
    userId: string,
    dto: CreateVideoDto,
  ): Promise<{ id: string; uploadId: string }> {
    const channel = await this.requireChannel(userId);
    const id = randomUUID();
    const storageKey = `videos/${id}/original${extname(dto.originalFilename)}`;

    const uploadId = await this.storageService.initiateMultipartUpload(
      storageKey,
      dto.contentType,
    );

    await this.videoRepository.save(
      this.videoRepository.create({
        id,
        channel_id: channel.id,
        original_filename: dto.originalFilename,
        storage_key: storageKey,
        upload_id: uploadId,
      }),
    );

    return { id, uploadId };
  }

  async presignPart(
    userId: string,
    videoId: string,
    partNumber: number,
  ): Promise<{ url: string }> {
    const channel = await this.requireChannel(userId);
    const video = await this.findOwnedOrThrow(videoId, channel.id);

    if (video.status !== VideoStatus.DRAFT) {
      throw new VideoNotInDraftException();
    }

    const url = await this.storageService.presignPartUpload(
      video.storage_key,
      video.upload_id!,
      partNumber,
    );

    return { url };
  }

  async completeUpload(
    userId: string,
    videoId: string,
    dto: CompleteUploadDto,
  ): Promise<{ id: string; status: VideoStatus }> {
    const channel = await this.requireChannel(userId);
    const video = await this.findOwnedOrThrow(videoId, channel.id);

    if (video.status !== VideoStatus.DRAFT) {
      throw new VideoNotInDraftException();
    }

    await this.storageService.completeMultipartUpload(
      video.storage_key,
      video.upload_id!,
      dto.parts.map((p) => ({ part: p.partNumber, etag: p.etag })),
    );

    video.status = VideoStatus.PROCESSING;
    await this.videoRepository.save(video);

    await this.enqueueProcessing(video.id);

    return { id: video.id, status: video.status };
  }

  async getVideo(
    userId: string,
    videoId: string,
  ): Promise<{
    id: string;
    status: VideoStatus;
    originalFilename: string;
    durationSeconds: number | null;
    createdAt: Date;
  }> {
    const channel = await this.requireChannel(userId);
    const video = await this.findOwnedOrThrow(videoId, channel.id);

    return {
      id: video.id,
      status: video.status,
      originalFilename: video.original_filename,
      durationSeconds: video.duration_seconds,
      createdAt: video.created_at,
    };
  }

  async retryVideo(
    userId: string,
    videoId: string,
  ): Promise<{ id: string; status: VideoStatus }> {
    const channel = await this.requireChannel(userId);
    const video = await this.findOwnedOrThrow(videoId, channel.id);

    if (video.status !== VideoStatus.ERROR) {
      throw new VideoNotInErrorStateException();
    }

    video.retry_count += 1;
    video.status = VideoStatus.PROCESSING;
    await this.videoRepository.save(video);

    await this.enqueueProcessing(video.id);

    return { id: video.id, status: video.status };
  }

  async findOwnedOrThrow(videoId: string, channelId: string): Promise<Video> {
    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video) {
      throw new VideoNotFoundException();
    }
    if (video.channel_id !== channelId) {
      throw new VideoAccessForbiddenException();
    }
    return video;
  }

  private async requireChannel(userId: string): Promise<Channel> {
    const channel = await this.channelsService.findByUserId(userId);
    if (!channel) {
      throw new Error(`No channel found for user ${userId}`);
    }
    return channel;
  }

  private async enqueueProcessing(videoId: string): Promise<void> {
    await this.videoProcessingQueue.add(
      'process-video',
      { videoId },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
  }
}
