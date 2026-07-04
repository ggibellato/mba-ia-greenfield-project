import { randomUUID } from 'crypto';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import storageConfig from '../config/storage.config';
import { StorageService } from './storage.service';

describe('StorageService (integration, real MinIO)', () => {
  let storageService: StorageService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [storageConfig] }),
      ],
      providers: [StorageService],
    }).compile();

    storageService = moduleRef.get(StorageService);
    await storageService.onModuleInit();
  });

  it('initiates a multipart upload and returns an uploadId', async () => {
    const key = `test/${randomUUID()}/original.mp4`;

    const uploadId = await storageService.initiateMultipartUpload(
      key,
      'video/mp4',
    );

    expect(typeof uploadId).toBe('string');
    expect(uploadId.length).toBeGreaterThan(0);
  });

  it('presigns a part upload URL containing the part number and uploadId', async () => {
    const key = `test/${randomUUID()}/original.mp4`;
    const uploadId = await storageService.initiateMultipartUpload(
      key,
      'video/mp4',
    );

    const url = await storageService.presignPartUpload(key, uploadId, 1);

    expect(url).toContain('partNumber=1');
    expect(url).toContain(`uploadId=${uploadId}`);
  });

  it('completes a multipart upload after the client PUTs the part directly', async () => {
    const key = `test/${randomUUID()}/original.mp4`;
    const uploadId = await storageService.initiateMultipartUpload(
      key,
      'video/mp4',
    );
    const url = await storageService.presignPartUpload(key, uploadId, 1);

    const putResponse = await fetch(url, {
      method: 'PUT',
      body: Buffer.from('fake video bytes'),
    });
    expect(putResponse.ok).toBe(true);
    const etag = putResponse.headers.get('etag')!.replace(/"/g, '');

    const finalEtag = await storageService.completeMultipartUpload(
      key,
      uploadId,
      [{ part: 1, etag }],
    );

    expect(typeof finalEtag).toBe('string');
    expect(finalEtag.length).toBeGreaterThan(0);
  });
});
