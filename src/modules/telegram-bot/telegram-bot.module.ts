import { Module } from '@nestjs/common';

import { TelegramBotService } from './telegram-bot.service';
import { SignalEngineModule } from '@modules/signal-engine/signal-engine.module';
import { PortfolioModule } from '@modules/portfolio/portfolio.module';
import { MarketDataModule } from '@modules/market-data/market-data.module';

@Module({
  imports: [SignalEngineModule, PortfolioModule, MarketDataModule],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
