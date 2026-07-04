import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './config.constants';

export default registerAs('storage', () => ({
  host: process.env.MINIO_HOST || ENV_DEFAULTS.MINIO_HOST,
  port: parseInt(process.env.MINIO_PORT || String(ENV_DEFAULTS.MINIO_PORT), 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
  bucket: process.env.MINIO_BUCKET || ENV_DEFAULTS.MINIO_BUCKET,
}));
