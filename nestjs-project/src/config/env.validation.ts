import * as Joi from 'joi';
import { ENV_DEFAULTS } from './config.constants';

export interface EnvVars {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRATION: string;
  JWT_REFRESH_EXPIRATION: string;
  CONFIRMATION_TOKEN_EXPIRATION_HOURS: number;
  PASSWORD_RESET_TOKEN_EXPIRATION_HOURS: number;
  APP_URL: string;
  MAIL_HOST: string;
  MAIL_PORT: number;
  MAIL_FROM: string;
  SWAGGER_ENABLED: 'true' | 'false';
  REDIS_HOST: string;
  REDIS_PORT: number;
  MINIO_HOST: string;
  MINIO_PORT: number;
  MINIO_USE_SSL: 'true' | 'false';
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_BUCKET: string;
}

export const envValidationSchema = Joi.object<EnvVars>({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default(ENV_DEFAULTS.NODE_ENV),
  PORT: Joi.number().port().default(ENV_DEFAULTS.PORT),
  DB_HOST: Joi.string().default(ENV_DEFAULTS.DB_HOST),
  DB_PORT: Joi.number().default(ENV_DEFAULTS.DB_PORT),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default(
    ENV_DEFAULTS.JWT_ACCESS_EXPIRATION,
  ),
  JWT_REFRESH_EXPIRATION: Joi.string().default(
    ENV_DEFAULTS.JWT_REFRESH_EXPIRATION,
  ),
  CONFIRMATION_TOKEN_EXPIRATION_HOURS: Joi.number().default(
    ENV_DEFAULTS.CONFIRMATION_TOKEN_EXPIRATION_HOURS,
  ),
  PASSWORD_RESET_TOKEN_EXPIRATION_HOURS: Joi.number().default(
    ENV_DEFAULTS.PASSWORD_RESET_TOKEN_EXPIRATION_HOURS,
  ),
  APP_URL: Joi.string().uri().default(ENV_DEFAULTS.APP_URL),
  MAIL_HOST: Joi.string().default(ENV_DEFAULTS.MAIL_HOST),
  MAIL_PORT: Joi.number().default(ENV_DEFAULTS.MAIL_PORT),
  MAIL_FROM: Joi.string().default(ENV_DEFAULTS.MAIL_FROM),
  SWAGGER_ENABLED: Joi.string()
    .valid('true', 'false')
    .default(ENV_DEFAULTS.SWAGGER_ENABLED),
  REDIS_HOST: Joi.string().default(ENV_DEFAULTS.REDIS_HOST),
  REDIS_PORT: Joi.number().default(ENV_DEFAULTS.REDIS_PORT),
  MINIO_HOST: Joi.string().default(ENV_DEFAULTS.MINIO_HOST),
  MINIO_PORT: Joi.number().default(ENV_DEFAULTS.MINIO_PORT),
  MINIO_USE_SSL: Joi.string()
    .valid('true', 'false')
    .default(ENV_DEFAULTS.MINIO_USE_SSL),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET: Joi.string().default(ENV_DEFAULTS.MINIO_BUCKET),
});
