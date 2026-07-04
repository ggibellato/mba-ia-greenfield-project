import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './config.constants';

export default registerAs('queue', () => ({
  host: process.env.REDIS_HOST || ENV_DEFAULTS.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || String(ENV_DEFAULTS.REDIS_PORT), 10),
}));
