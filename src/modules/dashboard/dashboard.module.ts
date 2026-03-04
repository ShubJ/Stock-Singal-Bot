import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller';
import { SignalEngineModule } from '@modules/signal-engine/signal-engine.module';
import { PortfolioModule } from '@modules/portfolio/portfolio.module';
import { TelegramBotModule } from '@modules/telegram-bot/telegram-bot.module';

@Module({
  imports: [SignalEngineModule, PortfolioModule, TelegramBotModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
