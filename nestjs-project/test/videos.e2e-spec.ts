import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { cleanAllTables } from '../src/test/create-test-data-source';
import { MailService } from '../src/mail/mail.service';
import { Video, VideoStatus } from '../src/videos/entities/video.entity';

interface VideoResponseBody {
  id?: string;
  uploadId?: string;
  url?: string;
  error?: string;
}

function body(res: Response): VideoResponseBody {
  return res.body as VideoResponseBody;
}

function getMailService(authService: AuthService): MailService {
  return (authService as unknown as { mailService: MailService }).mailService;
}

describe('Videos (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let videoRepository: Repository<Video>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    videoRepository = dataSource.getRepository(Video);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
  });

  let userCounter = 0;
  async function registerConfirmAndLogin(): Promise<string> {
    const email = `video_user_${++userCounter}@example.com`;
    const password = 'password123';
    const authService = app.get(AuthService);
    const mailServiceInstance = getMailService(authService);
    let capturedToken = '';
    jest
      .spyOn(mailServiceInstance, 'sendConfirmationEmail')
      .mockImplementationOnce(async (_e: string, _n: string, t: string) => {
        await Promise.resolve();
        capturedToken = t;
      });
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password });
    await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token: capturedToken });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return (res.body as { access_token: string }).access_token;
  }

  async function createVideo(
    accessToken: string,
  ): Promise<{ id: string; uploadId: string }> {
    const res = await request(app.getHttpServer())
      .post('/videos')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ originalFilename: 'my-video.mp4', contentType: 'video/mp4' });
    return { id: body(res).id!, uploadId: body(res).uploadId! };
  }

  describe('POST /videos', () => {
    it('returns 201 with { id, uploadId } and persists a draft row', async () => {
      const accessToken = await registerConfirmAndLogin();

      const res = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ originalFilename: 'my-video.mp4', contentType: 'video/mp4' })
        .expect(201);

      expect(body(res).id).toBeDefined();
      expect(body(res).uploadId).toBeDefined();

      const video = await videoRepository.findOneBy({ id: body(res).id });
      expect(video).not.toBeNull();
      expect(video!.status).toBe(VideoStatus.DRAFT);
      expect(video!.original_filename).toBe('my-video.mp4');
    });

    it('returns 400 with a validation error on missing originalFilename', async () => {
      const accessToken = await registerConfirmAndLogin();

      const res = await request(app.getHttpServer())
        .post('/videos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ contentType: 'video/mp4' })
        .expect(400);

      expect(body(res).error).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when no access token is provided', async () => {
      await request(app.getHttpServer())
        .post('/videos')
        .send({ originalFilename: 'my-video.mp4', contentType: 'video/mp4' })
        .expect(401);
    });
  });

  describe('GET /videos/:id/parts/:partNumber', () => {
    it('returns 200 with a presigned url for the owning channel', async () => {
      const accessToken = await registerConfirmAndLogin();
      const { id } = await createVideo(accessToken);

      const res = await request(app.getHttpServer())
        .get(`/videos/${id}/parts/1`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(body(res).url).toBeDefined();
    });

    it('returns 404 with VIDEO_NOT_FOUND for a non-existent video', async () => {
      const accessToken = await registerConfirmAndLogin();

      const res = await request(app.getHttpServer())
        .get('/videos/00000000-0000-0000-0000-000000000000/parts/1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(body(res).error).toBe('VIDEO_NOT_FOUND');
    });

    it('returns 403 with VIDEO_ACCESS_FORBIDDEN for a video owned by a different channel', async () => {
      const ownerToken = await registerConfirmAndLogin();
      const otherToken = await registerConfirmAndLogin();
      const { id } = await createVideo(ownerToken);

      const res = await request(app.getHttpServer())
        .get(`/videos/${id}/parts/1`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(body(res).error).toBe('VIDEO_ACCESS_FORBIDDEN');
    });

    it('returns 409 with VIDEO_NOT_IN_DRAFT for a video not in draft status', async () => {
      const accessToken = await registerConfirmAndLogin();
      const { id } = await createVideo(accessToken);
      await videoRepository.update(id, { status: VideoStatus.PROCESSING });

      const res = await request(app.getHttpServer())
        .get(`/videos/${id}/parts/1`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);

      expect(body(res).error).toBe('VIDEO_NOT_IN_DRAFT');
    });
  });
});
