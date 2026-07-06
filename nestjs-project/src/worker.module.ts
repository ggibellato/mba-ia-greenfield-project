import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';
import queueConfig from './config/queue.config';
import storageConfig from './config/storage.config';
import { rootConfigOptions } from './config/root-config.options';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { UsersModule } from './users/users.module';
import { VideoProcessor } from './videos/video.processor';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot(
      rootConfigOptions([databaseConfig, queueConfig, storageConfig]),
    ),
    DatabaseModule,
    QueueModule,
    UsersModule,
    VideosModule,
  ],
  providers: [VideoProcessor],
})
export class WorkerModule {}
