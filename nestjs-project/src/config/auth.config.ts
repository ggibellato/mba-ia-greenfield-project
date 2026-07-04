import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS } from './config.constants';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  jwtAccessExpiration:
    process.env.JWT_ACCESS_EXPIRATION || ENV_DEFAULTS.JWT_ACCESS_EXPIRATION,
  jwtRefreshExpiration:
    process.env.JWT_REFRESH_EXPIRATION || ENV_DEFAULTS.JWT_REFRESH_EXPIRATION,
  confirmationTokenExpirationHours: parseInt(
    process.env.CONFIRMATION_TOKEN_EXPIRATION_HOURS ||
      String(ENV_DEFAULTS.CONFIRMATION_TOKEN_EXPIRATION_HOURS),
    10,
  ),
  passwordResetTokenExpirationHours: parseInt(
    process.env.PASSWORD_RESET_TOKEN_EXPIRATION_HOURS ||
      String(ENV_DEFAULTS.PASSWORD_RESET_TOKEN_EXPIRATION_HOURS),
    10,
  ),
}));
