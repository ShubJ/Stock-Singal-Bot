import { registerAs } from '@nestjs/config';

export const telegramConfig = registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  adminUserId: process.env.TELEGRAM_ADMIN_USER_ID || '',
}));

export type TelegramConfig = ReturnType<typeof telegramConfig>;
