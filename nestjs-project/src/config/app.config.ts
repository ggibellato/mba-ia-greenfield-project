import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './config.constants';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || String(ENV_DEFAULTS.PORT), 10),
  nodeEnv: process.env.NODE_ENV || ENV_DEFAULTS.NODE_ENV,
  url: process.env.APP_URL ?? ENV_DEFAULTS.APP_URL,
}));
