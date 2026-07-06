import type { ConfigFactory, ConfigModuleOptions } from '@nestjs/config';
import { envValidationSchema } from './env.validation';

export function rootConfigOptions(load: ConfigFactory[]): ConfigModuleOptions {
  return {
    isGlobal: true,
    load,
    validationSchema: envValidationSchema,
    validationOptions: { allowUnknown: true, abortEarly: false },
  };
}
