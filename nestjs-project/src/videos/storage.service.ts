import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Client } from 'minio';
import storageConfig from '../config/storage.config';

export interface CompletedPart {
  part: number;
  etag: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: Client;
  private readonly bucket: string;

  constructor(
    @Inject(storageConfig.KEY)
    config: ConfigType<typeof storageConfig>,
  ) {
    this.client = new Client({
      endPoint: config.host,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    this.bucket = config.bucket;
  }

  async onModuleInit(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async initiateMultipartUpload(
    key: string,
    contentType: string,
  ): Promise<string> {
    return this.client.initiateNewMultipartUpload(this.bucket, key, {
      'Content-Type': contentType,
    });
  }

  async presignPartUpload(
    key: string,
    uploadId: string,
    partNumber: number,
    expirySeconds = 3600,
  ): Promise<string> {
    return this.client.presignedUrl('PUT', this.bucket, key, expirySeconds, {
      uploadId,
      partNumber: String(partNumber),
    });
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ): Promise<string> {
    const result = await this.client.completeMultipartUpload(
      this.bucket,
      key,
      uploadId,
      parts,
    );
    return result.etag;
  }
}
