import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Portfolio } from './entities/portfolio.entity';
import { Trade } from './entities/trade.entity';
import { PortfolioSnapshot } from './entities/portfolio-snapshot.entity';
import { PortfolioService } from './portfolio.service';
import { MarketDataModule } from '@modules/market-data/market-data.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Portfolio, Trade, PortfolioSnapshot]),
    MarketDataModule,
  ],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
