import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StockPrice } from './entities/stock-price.entity';
import { MarketDataService } from './market-data.service';

@Module({
  imports: [TypeOrmModule.forFeature([StockPrice])],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
