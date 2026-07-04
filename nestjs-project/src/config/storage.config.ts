import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  host: process.env.MINIO_HOST || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
  bucket: process.env.MINIO_BUCKET || 'streamtube-videos',
}));
