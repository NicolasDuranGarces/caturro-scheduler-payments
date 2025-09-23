import path from 'path';
import { config } from 'dotenv';
import { z } from 'zod';

const envFile = process.env.ENV_FILE ?? path.resolve(process.cwd(), '..', '.env');
config({ path: envFile, override: false });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BACKEND_PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters'),
  TOKEN_EXPIRES_IN: z.string().default('12h'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  BACKEND_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_NAME: z.string().default('Caturro Cafe Scheduler'),
  TZ: z.string().default('UTC'),
  ADMIN_DEFAULT_PASSWORD: z.string().min(8, 'ADMIN_DEFAULT_PASSWORD must be at least 8 characters'),
  BARISTA_DEFAULT_PASSWORD: z.string().min(8, 'BARISTA_DEFAULT_PASSWORD must be at least 8 characters'),
});

type Env = z.infer<typeof envSchema>;

const env: Env = envSchema.parse(process.env);

export default env;
