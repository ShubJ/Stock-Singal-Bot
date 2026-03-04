import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  defaultVirtualCapital: parseInt(process.env.DEFAULT_VIRTUAL_CAPITAL || '1000000', 10),
  signalsOutputDir: process.env.SIGNALS_OUTPUT_DIR || './data/signals',
  maxValidationIterations: parseInt(process.env.MAX_VALIDATION_ITERATIONS || '6', 10),
}));

export type AppConfig = ReturnType<typeof appConfig>;
