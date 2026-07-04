import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelsModule } from '../channels/channels.module';
import { Video } from './entities/video.entity';
import { StorageService } from './storage.service';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video]),
    ChannelsModule,
    BullModule.registerQueueAsync({
      name: 'video-processing',
      useFactory: () => ({}),
    }),
  ],
  controllers: [VideosController],
  providers: [VideosService, StorageService],
})
export class VideosModule {}
