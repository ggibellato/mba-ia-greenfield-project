import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import {
  VideoAccessForbiddenException,
  VideoNotFoundException,
  VideoNotInDraftException,
} from '../common/exceptions/domain.exception';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { Video, VideoStatus } from './entities/video.entity';
import { StorageService } from './storage.service';
import { VideosService } from './videos.service';

describe('VideosService — completeUpload', () => {
  let videosService: VideosService;
  let videoRepository: jest.Mocked<Repository<Video>>;
  let storageService: jest.Mocked<StorageService>;
  let channelsService: jest.Mocked<ChannelsService>;
  let videoProcessingQueue: jest.Mocked<Queue>;

  const channel = { id: 'channel-1', user_id: 'user-1' };
  const dto: CompleteUploadDto = {
    parts: [{ partNumber: 1, etag: 'etag-1' }],
  };

  function buildVideo(overrides: Partial<Video> = {}): Video {
    return {
      id: 'video-1',
      channel_id: channel.id,
      original_filename: 'my-video.mp4',
      storage_key: 'videos/video-1/original.mp4',
      thumbnail_key: null,
      status: VideoStatus.DRAFT,
      duration_seconds: null,
      upload_id: 'upload-1',
      retry_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
      channel: undefined as never,
      ...overrides,
    };
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VideosService,
        {
          provide: getRepositoryToken(Video),
          useValue: {
            findOneBy: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            completeMultipartUpload: jest.fn(),
          },
        },
        {
          provide: ChannelsService,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: getQueueToken('video-processing'),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    videosService = module.get(VideosService);
    videoRepository = module.get(getRepositoryToken(Video));
    storageService = module.get(StorageService);
    channelsService = module.get(ChannelsService);
    videoProcessingQueue = module.get(getQueueToken('video-processing'));

    channelsService.findByUserId.mockResolvedValue(channel as never);
  });

  it('completes the upload, flips status to processing, and enqueues process-video', async () => {
    const video = buildVideo();
    videoRepository.findOneBy.mockResolvedValue(video);
    storageService.completeMultipartUpload.mockResolvedValue('final-etag');
    videoRepository.save.mockResolvedValue({
      ...video,
      status: VideoStatus.PROCESSING,
    });

    const result = await videosService.completeUpload(
      channel.user_id,
      video.id,
      dto,
    );

    expect(storageService.completeMultipartUpload).toHaveBeenCalledWith(
      video.storage_key,
      video.upload_id,
      [{ part: 1, etag: 'etag-1' }],
    );
    expect(videoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: VideoStatus.PROCESSING }),
    );
    expect(videoProcessingQueue.add).toHaveBeenCalledWith(
      'process-video',
      { videoId: video.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
    expect(result).toEqual({ id: video.id, status: VideoStatus.PROCESSING });
  });

  it('throws VideoNotInDraftException when the video is not in draft status', async () => {
    const video = buildVideo({ status: VideoStatus.PROCESSING });
    videoRepository.findOneBy.mockResolvedValue(video);

    await expect(
      videosService.completeUpload(channel.user_id, video.id, dto),
    ).rejects.toThrow(VideoNotInDraftException);

    expect(storageService.completeMultipartUpload).not.toHaveBeenCalled();
    expect(videoProcessingQueue.add).not.toHaveBeenCalled();
  });

  it('throws VideoNotFoundException when the video does not exist', async () => {
    videoRepository.findOneBy.mockResolvedValue(null);

    await expect(
      videosService.completeUpload(channel.user_id, 'missing-id', dto),
    ).rejects.toThrow(VideoNotFoundException);
  });

  it('throws VideoAccessForbiddenException when the video belongs to another channel', async () => {
    const video = buildVideo({ channel_id: 'other-channel' });
    videoRepository.findOneBy.mockResolvedValue(video);

    await expect(
      videosService.completeUpload(channel.user_id, video.id, dto),
    ).rejects.toThrow(VideoAccessForbiddenException);

    expect(storageService.completeMultipartUpload).not.toHaveBeenCalled();
  });
});
