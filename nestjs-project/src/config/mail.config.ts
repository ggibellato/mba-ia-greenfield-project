import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './config.constants';

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST || ENV_DEFAULTS.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || String(ENV_DEFAULTS.MAIL_PORT), 10),
  from: process.env.MAIL_FROM || ENV_DEFAULTS.MAIL_FROM,
}));
