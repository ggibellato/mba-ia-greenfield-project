import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './config.constants';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || ENV_DEFAULTS.DB_HOST,
  port: parseInt(process.env.DB_PORT || String(ENV_DEFAULTS.DB_PORT), 10),
  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  name: process.env.DB_NAME!,
}));
