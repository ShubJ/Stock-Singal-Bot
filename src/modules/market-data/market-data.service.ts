import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StockPrice } from './entities/stock-price.entity';
import { PriceEntry } from '@common/types';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    @InjectRepository(StockPrice)
    private readonly stockPriceRepository: Repository<StockPrice>,
  ) {}

  async savePrices(prices: PriceEntry[]): Promise<void> {
    if (prices.length === 0) return;

    await this.stockPriceRepository
      .createQueryBuilder()
      .insert()
      .into(StockPrice)
      .values(
        prices.map((p) => ({
          symbol: p.symbol,
          name: p.name,
          date: p.date,
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close,
          volume: p.volume,
        })),
      )
      .orUpdate(['open', 'high', 'low', 'close', 'volume'], ['symbol', 'date'])
      .updateEntity(false)
      .execute();

    this.logger.log(`Saved ${prices.length} price entries`);
  }

  async getLatestPrice(symbol: string): Promise<StockPrice | null> {
    return this.stockPriceRepository.findOne({
      where: { symbol },
      order: { date: 'DESC' },
    });
  }

  async getHistoricalPrices(symbol: string, days: number): Promise<StockPrice[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.stockPriceRepository
      .createQueryBuilder('sp')
      .where('sp.symbol = :symbol', { symbol })
      .andWhere('sp.date >= :cutoffDate', { cutoffDate: cutoffDate.toISOString().split('T')[0] })
      .orderBy('sp.date', 'ASC')
      .getMany();
  }

  async getAllLatestPrices(): Promise<StockPrice[]> {
    const subQuery = this.stockPriceRepository
      .createQueryBuilder('sub')
      .select('sub.symbol')
      .addSelect('MAX(sub.date)', 'maxDate')
      .groupBy('sub.symbol');

    return this.stockPriceRepository
      .createQueryBuilder('sp')
      .innerJoin(
        `(${subQuery.getQuery()})`,
        'latest',
        'sp.symbol = latest.sub_symbol AND sp.date = latest.maxDate',
      )
      .getMany();
  }
}
