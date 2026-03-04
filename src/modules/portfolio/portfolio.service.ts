import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Portfolio } from './entities/portfolio.entity';
import { Trade } from './entities/trade.entity';
import { PortfolioSnapshot } from './entities/portfolio-snapshot.entity';
import { Signal } from '@modules/signal-engine/entities/signal.entity';
import { TradeAction } from '@common/enums/trade-action.enum';
import { TradeType } from '@common/enums/trade-type.enum';
import { TradeSource } from '@common/enums/trade-source.enum';
import { SignalType } from '@common/enums/signal-type.enum';
import { MarketDataService } from '@modules/market-data/market-data.service';

export interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
}

const MAX_AUTO_TRADES_PER_DAY = 5;

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(PortfolioSnapshot)
    private readonly snapshotRepository: Repository<PortfolioSnapshot>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly marketDataService: MarketDataService,
  ) {}

  async getOrCreatePortfolio(telegramUserId: string): Promise<Portfolio> {
    let portfolio = await this.portfolioRepository.findOne({
      where: { telegramUserId },
    });

    if (!portfolio) {
      const defaultCapital = this.configService.get<number>(
        'app.defaultVirtualCapital',
        1000000,
      );
      portfolio = this.portfolioRepository.create({
        telegramUserId,
        initialCapital: defaultCapital,
        cashBalance: defaultCapital,
      });
      portfolio = await this.portfolioRepository.save(portfolio);
      this.logger.log(`Created portfolio for user ${telegramUserId}`);
    }

    return portfolio;
  }

  async executeTrade(
    telegramUserId: string,
    symbol: string,
    action: TradeAction,
    tradeType: TradeType,
    quantity: number,
    price: number,
    source: TradeSource = TradeSource.MANUAL,
    signalId: number | null = null,
    targetPrice: number | null = null,
    stopLoss: number | null = null,
  ): Promise<Trade> {
    const portfolio = await this.getOrCreatePortfolio(telegramUserId);
    const totalValue = quantity * price;

    return this.dataSource.transaction(async (manager) => {
      if (action === TradeAction.BUY) {
        if (Number(portfolio.cashBalance) < totalValue) {
          throw new BadRequestException(
            `Insufficient cash. Available: ₹${portfolio.cashBalance}, Required: ₹${totalValue}`,
          );
        }
        portfolio.cashBalance = Number(portfolio.cashBalance) - totalValue;
      } else {
        const holdings = await this.getHoldings(telegramUserId);
        const holding = holdings.find((h) => h.symbol === symbol);

        if (!holding || holding.quantity < quantity) {
          throw new BadRequestException(
            `Insufficient holdings. Available: ${holding?.quantity || 0} shares of ${symbol}`,
          );
        }
        portfolio.cashBalance = Number(portfolio.cashBalance) + totalValue;
      }

      await manager.save(Portfolio, portfolio);

      const trade = manager.create(Trade, {
        portfolioId: portfolio.id,
        symbol,
        action,
        tradeType,
        quantity,
        price,
        totalValue,
        source,
        signalId,
        targetPrice,
        stopLoss,
      });

      const savedTrade = await manager.save(Trade, trade);
      this.logger.log(
        `Trade executed: ${action} ${quantity}x ${symbol} @ ₹${price} for user ${telegramUserId}`,
      );

      return savedTrade;
    });
  }

  async autoExecuteSignals(signals: Signal[]): Promise<void> {
    const autoTradePortfolios = await this.portfolioRepository.find({
      where: { autoTradeEnabled: true },
    });

    for (const portfolio of autoTradePortfolios) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayAutoTrades = await this.tradeRepository.count({
        where: {
          portfolioId: portfolio.id,
          source: TradeSource.AUTO_SIGNAL,
          createdAt: Between(todayStart, todayEnd),
        },
      });

      if (todayAutoTrades >= MAX_AUTO_TRADES_PER_DAY) {
        this.logger.log(
          `User ${portfolio.telegramUserId} already has ${MAX_AUTO_TRADES_PER_DAY} auto-trades today, skipping`,
        );
        continue;
      }

      const remainingSlots = MAX_AUTO_TRADES_PER_DAY - todayAutoTrades;
      const buySignals = signals.filter((s) =>
        [SignalType.STRONG_BUY, SignalType.BUY].includes(s.signalType),
      );

      for (const signal of buySignals.slice(0, remainingSlots)) {
        try {
          const positionValue =
            Number(portfolio.cashBalance) * (Number(signal.positionSizePct) / 100);
          const quantity = Math.floor(positionValue / Number(signal.currentPrice));

          if (quantity <= 0) continue;

          await this.executeTrade(
            portfolio.telegramUserId,
            signal.symbol,
            TradeAction.BUY,
            signal.tradeType,
            quantity,
            Number(signal.currentPrice),
            TradeSource.AUTO_SIGNAL,
            signal.id,
            Number(signal.targetPrice),
            Number(signal.stopLoss),
          );
        } catch (err) {
          const error = err as Error;
          this.logger.warn(
            `Auto-trade failed for ${signal.symbol} (user ${portfolio.telegramUserId}): ${error.message}`,
          );
        }
      }
    }
  }

  async getHoldings(telegramUserId: string): Promise<Holding[]> {
    const portfolio = await this.getOrCreatePortfolio(telegramUserId);

    const trades = await this.tradeRepository.find({
      where: { portfolioId: portfolio.id },
      order: { createdAt: 'ASC' },
    });

    const holdingsMap = new Map<string, { quantity: number; totalCost: number }>();

    for (const trade of trades) {
      const current = holdingsMap.get(trade.symbol) || { quantity: 0, totalCost: 0 };

      if (trade.action === TradeAction.BUY) {
        current.totalCost += Number(trade.quantity) * Number(trade.price);
        current.quantity += Number(trade.quantity);
      } else {
        const avgPrice = current.quantity > 0 ? current.totalCost / current.quantity : 0;
        current.totalCost -= Number(trade.quantity) * avgPrice;
        current.quantity -= Number(trade.quantity);
      }

      if (current.quantity > 0) {
        holdingsMap.set(trade.symbol, current);
      } else {
        holdingsMap.delete(trade.symbol);
      }
    }

    const holdings: Holding[] = [];
    for (const [symbol, data] of holdingsMap) {
      const latestPrice = await this.marketDataService.getLatestPrice(symbol);
      const currentPrice = latestPrice ? Number(latestPrice.close) : data.totalCost / data.quantity;
      const avgPrice = data.totalCost / data.quantity;
      const totalValue = data.quantity * currentPrice;
      const pnl = totalValue - data.totalCost;
      const pnlPercent = (pnl / data.totalCost) * 100;

      holdings.push({
        symbol,
        quantity: data.quantity,
        avgPrice,
        currentPrice,
        totalValue,
        pnl,
        pnlPercent,
      });
    }

    return holdings;
  }

  async getPortfolioSummary(telegramUserId: string): Promise<{
    portfolio: Portfolio;
    holdings: Holding[];
    totalValue: number;
    holdingsValue: number;
    pnlAbsolute: number;
    pnlPercent: number;
    totalTrades: number;
  }> {
    const portfolio = await this.getOrCreatePortfolio(telegramUserId);
    const holdings = await this.getHoldings(telegramUserId);
    const holdingsValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalValue = Number(portfolio.cashBalance) + holdingsValue;
    const pnlAbsolute = totalValue - Number(portfolio.initialCapital);
    const pnlPercent = (pnlAbsolute / Number(portfolio.initialCapital)) * 100;

    const totalTrades = await this.tradeRepository.count({
      where: { portfolioId: portfolio.id },
    });

    return {
      portfolio,
      holdings,
      totalValue,
      holdingsValue,
      pnlAbsolute,
      pnlPercent,
      totalTrades,
    };
  }

  async toggleAutoTrade(telegramUserId: string): Promise<boolean> {
    const portfolio = await this.getOrCreatePortfolio(telegramUserId);
    portfolio.autoTradeEnabled = !portfolio.autoTradeEnabled;
    await this.portfolioRepository.save(portfolio);
    return portfolio.autoTradeEnabled;
  }

  async getDailyPnL(telegramUserId: string): Promise<{
    todayPnl: number;
    todayPnlPercent: number;
    todayTrades: Trade[];
  }> {
    const portfolio = await this.getOrCreatePortfolio(telegramUserId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayTrades = await this.tradeRepository.find({
      where: {
        portfolioId: portfolio.id,
        createdAt: Between(todayStart, todayEnd),
      },
    });

    let todayPnl = 0;
    for (const trade of todayTrades) {
      if (trade.action === TradeAction.SELL) {
        const holdings = await this.getHoldings(telegramUserId);
        const holding = holdings.find((h) => h.symbol === trade.symbol);
        if (holding) {
          todayPnl += (Number(trade.price) - holding.avgPrice) * Number(trade.quantity);
        }
      }
    }

    const todayPnlPercent =
      Number(portfolio.initialCapital) > 0
        ? (todayPnl / Number(portfolio.initialCapital)) * 100
        : 0;

    return { todayPnl, todayPnlPercent, todayTrades };
  }

  async takeSnapshot(telegramUserId: string): Promise<PortfolioSnapshot> {
    const summary = await this.getPortfolioSummary(telegramUserId);
    const trades = await this.tradeRepository.find({
      where: { portfolioId: summary.portfolio.id },
    });

    const winningTrades = trades.filter((t) => {
      if (t.action !== TradeAction.SELL) return false;
      const buys = trades.filter(
        (bt) => bt.symbol === t.symbol && bt.action === TradeAction.BUY && bt.createdAt < t.createdAt,
      );
      const avgBuyPrice =
        buys.length > 0
          ? buys.reduce((s, b) => s + Number(b.price), 0) / buys.length
          : 0;
      return Number(t.price) > avgBuyPrice;
    });

    const snapshot = this.snapshotRepository.create({
      portfolioId: summary.portfolio.id,
      totalValue: summary.totalValue,
      cashBalance: Number(summary.portfolio.cashBalance),
      holdingsValue: summary.holdingsValue,
      pnlPercent: summary.pnlPercent,
      pnlAbsolute: summary.pnlAbsolute,
      holdings: summary.holdings as unknown as Record<string, unknown>[],
      totalTrades: summary.totalTrades,
      winningTrades: winningTrades.length,
    });

    return this.snapshotRepository.save(snapshot);
  }

  async getEquityCurve(telegramUserId: string): Promise<PortfolioSnapshot[]> {
    const portfolio = await this.getOrCreatePortfolio(telegramUserId);
    return this.snapshotRepository.find({
      where: { portfolioId: portfolio.id },
      order: { createdAt: 'ASC' },
    });
  }

  async getTradeHistory(
    telegramUserId: string,
    limit = 50,
  ): Promise<Trade[]> {
    const portfolio = await this.getOrCreatePortfolio(telegramUserId);
    return this.tradeRepository.find({
      where: { portfolioId: portfolio.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAllAutoTradePortfolios(): Promise<Portfolio[]> {
    return this.portfolioRepository.find({
      where: { autoTradeEnabled: true },
    });
  }

  async getAllPortfolios(): Promise<Portfolio[]> {
    return this.portfolioRepository.find();
  }
}
