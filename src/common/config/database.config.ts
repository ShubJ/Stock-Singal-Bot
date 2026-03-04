import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'stockbot',
  password: process.env.DB_PASSWORD || 'stockbot_secret',
  database: process.env.DB_DATABASE || 'stock_signal_bot',
}));

export type DatabaseConfig = ReturnType<typeof databaseConfig>;
