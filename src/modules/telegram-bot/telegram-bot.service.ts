import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';

import { SignalEngineService } from '@modules/signal-engine/signal-engine.service';
import { PortfolioService } from '@modules/portfolio/portfolio.service';
import { MarketDataService } from '@modules/market-data/market-data.service';
import { Signal } from '@modules/signal-engine/entities/signal.entity';
import { TradeAction } from '@common/enums/trade-action.enum';
import { TradeType } from '@common/enums/trade-type.enum';
import { TradeSource } from '@common/enums/trade-source.enum';

const TRADE_TYPE_EMOJI: Record<string, string> = {
  IMPULSE: '⚡',
  LONG_TERM: '🏦',
};

const SIGNAL_TYPE_EMOJI: Record<string, string> = {
  STRONG_BUY: '🟢🟢',
  BUY: '🟢',
  HOLD: '🟡',
  SELL: '🔴',
  STRONG_SELL: '🔴🔴',
};

/** Escape HTML special characters for Telegram HTML parse mode */
function esc(text: string | number | null | undefined): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf | null = null;
  private readonly subscribedChatIds = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly signalEngineService: SignalEngineService,
    private readonly portfolioService: PortfolioService,
    private readonly marketDataService: MarketDataService,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = this.configService.get<string>('telegram.botToken');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set, bot will not start');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerCommands();

    this.bot.launch().catch((err) => {
      this.logger.error(`Failed to launch Telegram bot: ${err.message}`);
    });

    this.logger.log('Telegram bot started');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) {
      this.bot.stop('Application shutting down');
    }
  }

  private registerCommands(): void {
    if (!this.bot) return;

    this.bot.command('start', (ctx) => this.safeHandle(ctx, () => this.handleStart(ctx)));
    this.bot.command('help', (ctx) => this.safeHandle(ctx, () => this.handleHelp(ctx)));
    this.bot.command('signals', (ctx) => this.safeHandle(ctx, () => this.handleSignals(ctx)));
    this.bot.command('impulse', (ctx) => this.safeHandle(ctx, () => this.handleImpulse(ctx)));
    this.bot.command('longterm', (ctx) => this.safeHandle(ctx, () => this.handleLongTerm(ctx)));
    this.bot.command('portfolio', (ctx) => this.safeHandle(ctx, () => this.handlePortfolio(ctx)));
    this.bot.command('trade', (ctx) => this.safeHandle(ctx, () => this.handleTrade(ctx)));
    this.bot.command('pnl', (ctx) => this.safeHandle(ctx, () => this.handlePnL(ctx)));
    this.bot.command('auto', (ctx) => this.safeHandle(ctx, () => this.handleAuto(ctx)));
    this.bot.command('performance', (ctx) =>
      this.safeHandle(ctx, () => this.handlePerformance(ctx)),
    );
    this.bot.command('analyze', (ctx) => this.safeHandle(ctx, () => this.handleAnalyze(ctx)));
    this.bot.command('market', (ctx) => this.safeHandle(ctx, () => this.handleMarket(ctx)));
  }

  /**
   * Wraps every command handler with try/catch so errors
   * reply to the user instead of crashing the bot process.
   */
  private async safeHandle(ctx: Context, handler: () => Promise<void>): Promise<void> {
    try {
      await handler();
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Command error: ${error.message}`, error.stack);
      try {
        await ctx.reply(`Something went wrong: ${esc(error.message)}`);
      } catch {
        // If even the error reply fails, just log it
        this.logger.error('Failed to send error reply to user');
      }
    }
  }

  private async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString() || '';
    this.subscribedChatIds.add(ctx.chat?.id.toString() || '');
    await this.portfolioService.getOrCreatePortfolio(userId);

    await ctx.reply(
      '🚀 <b>Stock Signal Bot</b>\n\n' +
        'Welcome! I provide AI-powered Indian stock market signals with a virtual portfolio tracker.\n\n' +
        '📊 Your virtual portfolio has been created with ₹10,00,000.\n\n' +
        'Use /help to see all available commands.',
      { parse_mode: 'HTML' },
    );
  }

  private async handleHelp(ctx: Context): Promise<void> {
    await ctx.reply(
      '📖 <b>Available Commands</b>\n\n' +
        '/signals — Today\'s stock signals\n' +
        '/impulse — Short-term momentum signals ⚡\n' +
        '/longterm — Long-term value signals 🏦\n' +
        '/portfolio — Your virtual portfolio summary\n' +
        '/trade BUY|SELL SYMBOL QTY — Execute a trade\n' +
        '/pnl — Today\'s P&amp;L\n' +
        '/auto — Toggle auto-trading\n' +
        '/performance — Signal accuracy stats\n' +
        '/analyze SYMBOL — Quick analysis of a stock\n' +
        '/market — Daily market intelligence &amp; reasoning',
      { parse_mode: 'HTML' },
    );
  }

  private async handleSignals(ctx: Context): Promise<void> {
    const signals = await this.signalEngineService.getTodaySignals();
    if (signals.length === 0) {
      await ctx.reply('📭 No signals generated yet today. Check back after market analysis runs.');
      return;
    }
    await ctx.reply(this.formatDailySignals(signals), { parse_mode: 'HTML' });
  }

  private async handleImpulse(ctx: Context): Promise<void> {
    const signals = await this.signalEngineService.getSignalsByType(TradeType.IMPULSE);
    if (signals.length === 0) {
      await ctx.reply('No impulse (short-term) signals today.');
      return;
    }
    await ctx.reply(
      `⚡ <b>IMPULSE SIGNALS (1-5 days)</b>\n\n${this.formatSignalList(signals)}`,
      { parse_mode: 'HTML' },
    );
  }

  private async handleLongTerm(ctx: Context): Promise<void> {
    const signals = await this.signalEngineService.getSignalsByType(TradeType.LONG_TERM);
    if (signals.length === 0) {
      await ctx.reply('No long-term signals today.');
      return;
    }
    await ctx.reply(
      `🏦 <b>LONG-TERM SIGNALS (weeks+)</b>\n\n${this.formatSignalList(signals)}`,
      { parse_mode: 'HTML' },
    );
  }

  private async handlePortfolio(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString() || '';
    const summary = await this.portfolioService.getPortfolioSummary(userId);

    let holdingsText = '';
    if (summary.holdings.length > 0) {
      holdingsText = summary.holdings
        .map(
          (h) =>
            `  ${esc(h.symbol)}: ${h.quantity} shares @ ₹${h.avgPrice.toFixed(2)} → ₹${h.currentPrice.toFixed(2)} (${h.pnlPercent >= 0 ? '+' : ''}${h.pnlPercent.toFixed(2)}%)`,
        )
        .join('\n');
    } else {
      holdingsText = '  No holdings';
    }

    const pnlEmoji = summary.pnlAbsolute >= 0 ? '📈' : '📉';

    await ctx.reply(
      `💼 <b>Portfolio Summary</b>\n\n` +
        `💰 Cash: ₹${Number(summary.portfolio.cashBalance).toLocaleString('en-IN')}\n` +
        `📦 Holdings Value: ₹${summary.holdingsValue.toLocaleString('en-IN')}\n` +
        `📊 Total Value: ₹${summary.totalValue.toLocaleString('en-IN')}\n` +
        `${pnlEmoji} P&amp;L: ₹${summary.pnlAbsolute.toLocaleString('en-IN')} (${summary.pnlPercent >= 0 ? '+' : ''}${summary.pnlPercent.toFixed(2)}%)\n` +
        `🔄 Total Trades: ${summary.totalTrades}\n` +
        `🤖 Auto-Trade: ${summary.portfolio.autoTradeEnabled ? 'ON ✅' : 'OFF ❌'}\n\n` +
        `<b>Holdings:</b>\n${holdingsText}`,
      { parse_mode: 'HTML' },
    );
  }

  private async handleTrade(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString() || '';
    const text = (ctx.message && 'text' in ctx.message ? ctx.message.text : '') || '';
    const parts = text.split(/\s+/).slice(1);

    if (parts.length < 3) {
      await ctx.reply(
        'Usage: /trade BUY|SELL SYMBOL QUANTITY\nExample: /trade BUY RELIANCE 10',
      );
      return;
    }

    const [actionStr, symbol, qtyStr] = parts;
    const action = actionStr.toUpperCase();
    const quantity = parseInt(qtyStr, 10);

    if (action !== 'BUY' && action !== 'SELL') {
      await ctx.reply('❌ Action must be BUY or SELL');
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      await ctx.reply('❌ Quantity must be a positive number');
      return;
    }

    const latestPrice = await this.getApproxPrice(symbol.toUpperCase());
    const trade = await this.portfolioService.executeTrade(
      userId,
      symbol.toUpperCase(),
      action === 'BUY' ? TradeAction.BUY : TradeAction.SELL,
      TradeType.IMPULSE,
      quantity,
      latestPrice,
      TradeSource.MANUAL,
    );

    await ctx.reply(
      `✅ <b>Trade Executed</b>\n\n` +
        `${action === 'BUY' ? '🟢' : '🔴'} ${esc(action)} ${quantity}x ${esc(symbol.toUpperCase())}\n` +
        `💵 Price: ₹${latestPrice.toFixed(2)}\n` +
        `💰 Total: ₹${Number(trade.totalValue).toLocaleString('en-IN')}`,
      { parse_mode: 'HTML' },
    );
  }

  private async handlePnL(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString() || '';
    const pnl = await this.portfolioService.getDailyPnL(userId);
    const emoji = pnl.todayPnl >= 0 ? '📈' : '📉';

    await ctx.reply(
      `${emoji} <b>Today's P&amp;L</b>\n\n` +
        `💰 P&amp;L: ₹${pnl.todayPnl.toLocaleString('en-IN')} (${pnl.todayPnlPercent >= 0 ? '+' : ''}${pnl.todayPnlPercent.toFixed(2)}%)\n` +
        `🔄 Trades Today: ${pnl.todayTrades.length}`,
      { parse_mode: 'HTML' },
    );
  }

  private async handleAuto(ctx: Context): Promise<void> {
    const userId = ctx.from?.id.toString() || '';
    const enabled = await this.portfolioService.toggleAutoTrade(userId);

    await ctx.reply(
      enabled
        ? '🤖 Auto-trading <b>ENABLED</b> ✅\nI\'ll automatically execute up to 5 trades per day based on signals.'
        : '🤖 Auto-trading <b>DISABLED</b> ❌\nYou\'ll need to execute trades manually.',
      { parse_mode: 'HTML' },
    );
  }

  private async handlePerformance(ctx: Context): Promise<void> {
    const stats = await this.signalEngineService.getPerformanceStats();

    let typeBreakdown = '';
    for (const [type, data] of Object.entries(stats.byType)) {
      const emoji = type === 'IMPULSE' ? '⚡' : '🏦';
      typeBreakdown += `${emoji} ${esc(type)}: ${data.accurate}/${data.total} (${data.rate.toFixed(1)}%)\n`;
    }

    await ctx.reply(this.formatPerformance(stats, typeBreakdown), { parse_mode: 'HTML' });
  }

  private async handleAnalyze(ctx: Context): Promise<void> {
    const text = (ctx.message && 'text' in ctx.message ? ctx.message.text : '') || '';
    const symbol = text.split(/\s+/)[1]?.toUpperCase();

    if (!symbol) {
      await ctx.reply('Usage: /analyze SYMBOL\nExample: /analyze RELIANCE');
      return;
    }

    const history = await this.signalEngineService.getSignalHistory(30);
    const symbolSignals = history.filter((s) => s.symbol === symbol);

    if (symbolSignals.length === 0) {
      await ctx.reply(
        `No recent signals found for ${esc(symbol)}. It may not have been analyzed yet.`,
      );
      return;
    }

    const latest = symbolSignals[0];
    await ctx.reply(
      `📊 <b>Analysis: ${esc(symbol)}</b>\n\n` +
        `${SIGNAL_TYPE_EMOJI[latest.signalType] || ''} Signal: ${esc(latest.signalType)}\n` +
        `${TRADE_TYPE_EMOJI[latest.tradeType] || ''} Type: ${esc(latest.tradeType)}\n` +
        `🎯 Confidence: ${Number(latest.confidence).toFixed(1)}%\n` +
        `💵 Current: ₹${Number(latest.currentPrice).toFixed(2)}\n` +
        `🎯 Target: ₹${Number(latest.targetPrice).toFixed(2)}\n` +
        `🛑 Stop Loss: ₹${Number(latest.stopLoss).toFixed(2)}\n` +
        `📐 R:R Ratio: ${Number(latest.riskRewardRatio).toFixed(2)}\n` +
        `🔄 Validation Rounds: ${latest.validationIterations}\n\n` +
        `<b>Reasoning:</b>\n${esc(latest.reasoning || 'N/A')}`,
      { parse_mode: 'HTML' },
    );
  }

  private async handleMarket(ctx: Context): Promise<void> {
    const signals = await this.signalEngineService.getTodaySignals();
    if (signals.length === 0) {
      await ctx.reply('📭 No signals generated yet today. Market intelligence will be available after analysis runs.');
      return;
    }
    await ctx.reply(this.formatMarketIntelligence(signals), { parse_mode: 'HTML' });
  }

  formatMarketIntelligence(signals: Signal[]): string {
    const dateStr = new Date().toLocaleDateString('en-IN');

    // Market Overview
    const marketSummary = signals[0]?.marketSummary || 'No macro overview available.';
    let message = `🌍 <b>Market Intelligence — ${esc(dateStr)}</b>\n\n`;
    message += `📰 <b>Market Overview</b>\n${esc(marketSummary)}\n\n`;

    // Per-signal reasoning
    message += `📊 <b>Signal Reasoning</b>\n`;

    const bullish: string[] = [];
    const bearish: string[] = [];

    for (const s of signals) {
      const isBullish = s.signalType === 'BUY' || s.signalType === 'STRONG_BUY';
      const emoji = isBullish ? '🟢' : '🔴';
      const sentiment = s.sentiment as Record<string, unknown> | null;

      // Extract FII/DII flow direction
      let fiiDiiLabel = 'N/A';
      if (sentiment) {
        const fiiFlow = sentiment.fiiFlow ?? sentiment.fii_flow ?? sentiment.fiiDiiFlow;
        if (typeof fiiFlow === 'string') {
          fiiDiiLabel = fiiFlow;
        } else if (typeof fiiFlow === 'number') {
          fiiDiiLabel = fiiFlow >= 0 ? 'Positive' : 'Negative';
        }
      }

      // Extract news score
      let newsLabel = 'N/A';
      if (sentiment) {
        const newsScore = sentiment.newsScore ?? sentiment.news_score ?? sentiment.overallScore;
        if (typeof newsScore === 'number') {
          newsLabel = `${newsScore.toFixed(1)}/10`;
        }
      }

      const reasoning = s.reasoning || 'No detailed reasoning available.';

      const block =
        `\n${emoji} <b>${esc(s.symbol)}</b> (${esc(s.name)})\n` +
        `Signal: ${esc(s.signalType)} | Confidence: ${Number(s.confidence).toFixed(1)}%\n` +
        `FII/DII: ${esc(fiiDiiLabel)} | News: ${esc(newsLabel)}\n` +
        `Reasoning: ${esc(reasoning)}`;

      message += block + '\n';

      if (isBullish) {
        bullish.push(s.symbol);
      } else {
        bearish.push(s.symbol);
      }
    }

    // Sector impact summary
    message += `\n📈 <b>Sector Impact Summary</b>\n`;
    if (bullish.length > 0) {
      message += `🟢 Bullish: ${bullish.map(esc).join(', ')}\n`;
    }
    if (bearish.length > 0) {
      message += `🔴 Bearish: ${bearish.map(esc).join(', ')}\n`;
    }

    return message;
  }

  formatDailySignals(signals: Signal[]): string {
    const header = `📊 <b>Today's Signals</b> (${new Date().toLocaleDateString('en-IN')})\n`;
    const marketSummary = signals[0]?.marketSummary
      ? `\n📰 <i>${esc(signals[0].marketSummary)}</i>\n`
      : '';

    return `${header}${marketSummary}\n${this.formatSignalList(signals)}`;
  }

  private formatSignalList(signals: Signal[]): string {
    return signals
      .map((s) => {
        const signalEmoji = SIGNAL_TYPE_EMOJI[s.signalType] || '';
        const tradeEmoji = TRADE_TYPE_EMOJI[s.tradeType] || '';
        return (
          `${signalEmoji} <b>${esc(s.symbol)}</b> (${esc(s.name)}) ${tradeEmoji}\n` +
          `   Signal: ${esc(s.signalType)} | Confidence: ${Number(s.confidence).toFixed(1)}%\n` +
          `   Price: ₹${Number(s.currentPrice).toFixed(2)} → Target: ₹${Number(s.targetPrice).toFixed(2)}\n` +
          `   Stop Loss: ₹${Number(s.stopLoss).toFixed(2)} | R:R: ${Number(s.riskRewardRatio).toFixed(2)}\n` +
          `   Validations: ${s.validationIterations} rounds`
        );
      })
      .join('\n\n');
  }

  formatPerformance(
    stats: { total: number; accurate: number; accuracyRate: number },
    typeBreakdown: string,
  ): string {
    return (
      `📈 <b>Signal Performance</b>\n\n` +
      `📊 Total Resolved: ${stats.total}\n` +
      `✅ Accurate: ${stats.accurate}\n` +
      `🎯 Accuracy: ${stats.accuracyRate.toFixed(1)}%\n\n` +
      `<b>By Type:</b>\n${typeBreakdown}`
    );
  }

  async broadcastMessage(message: string): Promise<void> {
    if (!this.bot) return;

    // Pull all user IDs from DB so broadcasts survive restarts
    const portfolios = await this.portfolioService.getAllPortfolios();
    const userIds = new Set<string>(
      portfolios.map((p) => p.telegramUserId),
    );
    // Also include any in-memory subscribers (users who sent /start but have no portfolio yet)
    for (const chatId of this.subscribedChatIds) {
      userIds.add(chatId);
    }

    this.logger.log(`Broadcasting to ${userIds.size} users`);

    for (const userId of userIds) {
      try {
        await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'HTML' });
      } catch (err) {
        const error = err as Error;
        this.logger.warn(`Failed to broadcast to ${userId}: ${error.message}`);
      }
    }
  }

  async sendToUser(userId: string, message: string): Promise<void> {
    if (!this.bot) return;

    try {
      await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'HTML' });
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Failed to send message to user ${userId}: ${error.message}`);
    }
  }

  private async getApproxPrice(symbol: string): Promise<number> {
    const latestPrice = await this.marketDataService.getLatestPrice(symbol);
    if (latestPrice) {
      return Number(latestPrice.close);
    }

    const history = await this.signalEngineService.getSignalHistory(7);
    const symbolSignal = history.find((s) => s.symbol === symbol);
    if (symbolSignal) {
      return Number(symbolSignal.currentPrice);
    }

    throw new Error(
      `No price data available for ${symbol}. Please wait for the next analysis run.`,
    );
  }
}
