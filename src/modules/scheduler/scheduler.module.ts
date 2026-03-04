import { Module } from '@nestjs/common';

import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { SignalEngineModule } from '@modules/signal-engine/signal-engine.module';
import { PortfolioModule } from '@modules/portfolio/portfolio.module';
import { TelegramBotModule } from '@modules/telegram-bot/telegram-bot.module';

@Module({
  imports: [SignalEngineModule, PortfolioModule, TelegramBotModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
