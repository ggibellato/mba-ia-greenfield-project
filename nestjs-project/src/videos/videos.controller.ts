import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import { CreateVideoDto } from './dto/create-video.dto';
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
}
