import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Signal } from './entities/signal.entity';
import { SignalEngineService } from './signal-engine.service';
import { SignalFileWatcherService } from './signal-file-watcher.service';
import { MarketDataModule } from '@modules/market-data/market-data.module';

@Module({
  imports: [TypeOrmModule.forFeature([Signal]), MarketDataModule],
  providers: [SignalEngineService, SignalFileWatcherService],
  exports: [SignalEngineService],
})
export class SignalEngineModule {}
