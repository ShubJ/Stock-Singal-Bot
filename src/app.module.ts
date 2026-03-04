import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { appConfig, databaseConfig, telegramConfig } from '@common/config';
import { MarketDataModule } from '@modules/market-data/market-data.module';
import { SignalEngineModule } from '@modules/signal-engine/signal-engine.module';
import { PortfolioModule } from '@modules/portfolio/portfolio.module';
import { TelegramBotModule } from '@modules/telegram-bot/telegram-bot.module';
import { SchedulerModule } from '@modules/scheduler/scheduler.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, telegramConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('app.nodeEnv') === 'development',
        logging: configService.get<string>('app.nodeEnv') === 'development',
      }),
    }),
    ScheduleModule.forRoot(),
    MarketDataModule,
    SignalEngineModule,
    PortfolioModule,
    TelegramBotModule,
    SchedulerModule,
    DashboardModule,
  ],
})
export class AppModule {}
