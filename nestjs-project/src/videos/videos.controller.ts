import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Redirect,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideoStatus } from './entities/video.entity';
import { VideosService } from './videos.service';

@ApiTags('videos')
@ApiBearerAuth('access-token')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @ApiOperation({
    summary: 'Initiate a video upload',
    description:
      'Creates a draft video and starts a MinIO multipart upload, returning the upload id used by subsequent part-presign calls.',
  })
  @ApiResponse({
    status: 201,
    description: 'Draft video created and upload initiated',
    schema: {
      properties: {
        id: { type: 'string', format: 'uuid' },
        uploadId: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVideoDto,
  ): Promise<{ id: string; uploadId: string }> {
    return this.videosService.createVideo(user.sub, dto);
  }

  @Get(':id/parts/:partNumber')
  @ApiOperation({
    summary: 'Presign an upload part',
    description:
      'Returns a presigned PUT URL the client uses to upload one part of the multipart upload directly to MinIO.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned part upload URL',
    schema: { properties: { url: { type: 'string' } } },
  })
  @ApiResponse({
    status: 403,
    description: 'Video is not owned by the authenticated channel',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not in draft status',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async presignPart(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('partNumber', ParseIntPipe) partNumber: number,
  ): Promise<{ url: string }> {
    return this.videosService.presignPart(user.sub, id, partNumber);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete a video upload',
    description:
      'Finalizes the multipart upload in MinIO, flips the video to processing, and enqueues the background processing job.',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload completed, video is now processing',
    schema: {
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'processing' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 403,
    description: 'Video is not owned by the authenticated channel',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not in draft status',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async complete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CompleteUploadDto,
  ): Promise<{ id: string; status: VideoStatus }> {
    return this.videosService.completeUpload(user.sub, id, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get video status',
    description:
      'Returns the current status and metadata of a video, for polling upload/processing progress.',
  })
  @ApiResponse({
    status: 200,
    description: 'Video status and metadata',
    schema: {
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'processing' },
        originalFilename: { type: 'string' },
        durationSeconds: { type: 'number', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Video is not owned by the authenticated channel',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async getStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<{
    id: string;
    status: VideoStatus;
    originalFilename: string;
    durationSeconds: number | null;
    createdAt: Date;
  }> {
    return this.videosService.getVideo(user.sub, id);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry a failed video',
    description:
      'Re-enqueues processing for a video in error status, without requiring a fresh upload.',
  })
  @ApiResponse({
    status: 200,
    description: 'Retry accepted, video is now processing',
    schema: {
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'processing' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Video is not owned by the authenticated channel',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not in error status',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async retry(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<{ id: string; status: VideoStatus }> {
    return this.videosService.retryVideo(user.sub, id);
  }

  @Get(':id/stream')
  @Redirect()
  @ApiOperation({
    summary: 'Stream a video',
    description:
      'Redirects to a short-lived presigned MinIO URL that serves the video bytes, including Range support.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to a presigned MinIO URL',
  })
  @ApiResponse({
    status: 403,
    description: 'Video is not owned by the authenticated channel',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not ready',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async stream(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.videosService.getStreamUrl(user.sub, id);
    return { url, statusCode: HttpStatus.FOUND };
  }

  @Get(':id/download')
  @Redirect()
  @ApiOperation({
    summary: 'Download a video',
    description:
      'Redirects to a short-lived presigned MinIO URL that forces a file download via content-disposition.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to a presigned MinIO URL',
  })
  @ApiResponse({
    status: 403,
    description: 'Video is not owned by the authenticated channel',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not ready',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<{ url: string; statusCode: number }> {
    const url = await this.videosService.getDownloadUrl(user.sub, id);
    return { url, statusCode: HttpStatus.FOUND };
  }
}
