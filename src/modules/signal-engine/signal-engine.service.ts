import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { Signal } from './entities/signal.entity';
import { SignalType } from '@common/enums/signal-type.enum';
import { TradeType } from '@common/enums/trade-type.enum';
import { AnalysisSignal } from '@common/types';
import { MarketDataService } from '@modules/market-data/market-data.service';

@Injectable()
export class SignalEngineService {
  private readonly logger = new Logger(SignalEngineService.name);

  constructor(
    @InjectRepository(Signal)
    private readonly signalRepository: Repository<Signal>,
    private readonly marketDataService: MarketDataService,
  ) {}

  async importAnalysisOutput(
    signals: AnalysisSignal[],
    marketSummary: string,
  ): Promise<Signal[]> {
    const savedSignals: Signal[] = [];

    for (const raw of signals) {
      const result = await this.signalRepository
        .createQueryBuilder()
        .insert()
        .into(Signal)
        .values({
          symbol: raw.symbol,
          name: raw.name,
          signalType: raw.signalType as SignalType,
          tradeType: raw.tradeType as TradeType,
          confidence: raw.confidence,
          currentPrice: raw.currentPrice,
          targetPrice: raw.targetPrice,
          stopLoss: raw.stopLoss,
          riskRewardRatio: raw.riskRewardRatio,
          positionSizePct: raw.positionSizePct,
          technicals: () => `'${JSON.stringify(raw.technicals ?? null)}'::jsonb`,
          sentiment: () => `'${JSON.stringify(raw.sentiment ?? null)}'::jsonb`,
          reasoning: raw.reasoning,
          validationIterations: raw.validationIterations,
          validationLog: () => `'${JSON.stringify(raw.validationLog ?? null)}'::jsonb`,
          marketSummary,
        })
        .execute();

      const insertedId = result.identifiers[0].id as number;
      const saved = await this.signalRepository.findOneOrFail({ where: { id: insertedId } });
      savedSignals.push(saved);
      this.logger.log(`Imported signal: ${raw.symbol} - ${raw.signalType} (${raw.tradeType})`);
    }

    return savedSignals;
  }

  async getTodaySignals(): Promise<Signal[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return this.signalRepository.find({
      where: {
        createdAt: Between(startOfDay, endOfDay),
      },
      order: { confidence: 'DESC' },
    });
  }

  async getSignalsByType(tradeType: TradeType): Promise<Signal[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return this.signalRepository.find({
      where: {
        tradeType,
        createdAt: Between(startOfDay, endOfDay),
      },
      order: { confidence: 'DESC' },
    });
  }

  async getSignalHistory(days: number): Promise<Signal[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.signalRepository
      .createQueryBuilder('s')
      .where('s.created_at >= :cutoff', { cutoff })
      .orderBy('s.created_at', 'DESC')
      .getMany();
  }

  async getPerformanceStats(): Promise<{
    total: number;
    resolved: number;
    accurate: number;
    accuracyRate: number;
    byType: Record<string, { total: number; accurate: number; rate: number }>;
  }> {
    const allSignals = await this.signalRepository.find({
      where: { outcomeResolved: true },
    });

    const total = allSignals.length;
    const accurate = allSignals.filter((s) => s.wasAccurate).length;

    const byType: Record<string, { total: number; accurate: number; rate: number }> = {};
    for (const type of Object.values(TradeType)) {
      const typeSignals = allSignals.filter((s) => s.tradeType === type);
      const typeAccurate = typeSignals.filter((s) => s.wasAccurate).length;
      byType[type] = {
        total: typeSignals.length,
        accurate: typeAccurate,
        rate: typeSignals.length > 0 ? (typeAccurate / typeSignals.length) * 100 : 0,
      };
    }

    return {
      total,
      resolved: total,
      accurate,
      accuracyRate: total > 0 ? (accurate / total) * 100 : 0,
      byType,
    };
  }

  async resolveOutcome(
    signalId: number,
    actualPrice: number,
  ): Promise<Signal> {
    const signal = await this.signalRepository.findOneOrFail({ where: { id: signalId } });

    const isBuySignal = [SignalType.STRONG_BUY, SignalType.BUY].includes(signal.signalType);
    const isSellSignal = [SignalType.STRONG_SELL, SignalType.SELL].includes(signal.signalType);

    let wasAccurate = false;
    if (isBuySignal) {
      wasAccurate = actualPrice >= signal.targetPrice;
    } else if (isSellSignal) {
      wasAccurate = actualPrice <= signal.targetPrice;
    }

    signal.outcomeResolved = true;
    signal.wasAccurate = wasAccurate;
    signal.actualOutcomePrice = actualPrice;

    return this.signalRepository.save(signal);
  }

  async getUnresolvedSignals(): Promise<Signal[]> {
    return this.signalRepository.find({
      where: { outcomeResolved: false },
      order: { createdAt: 'ASC' },
    });
  }
}
