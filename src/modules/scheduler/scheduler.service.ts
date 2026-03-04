import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execFile } from 'child_process';
import { join } from 'path';

import { SignalEngineService } from '@modules/signal-engine/signal-engine.service';
import { PortfolioService } from '@modules/portfolio/portfolio.service';
import { TelegramBotService } from '@modules/telegram-bot/telegram-bot.service';
import { TradeType } from '@common/enums/trade-type.enum';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly signalEngineService: SignalEngineService,
    private readonly portfolioService: PortfolioService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  // 8:30 AM IST Mon-Fri: Run analysis script to generate today's signals
  @Cron('30 8 * * 1-5', { timeZone: 'Asia/Kolkata' })
  async runMorningAnalysis(): Promise<void> {
    this.logger.log('Running morning analysis script...');

    const scriptPath = join(process.cwd(), 'scripts', 'run-analysis.sh');
    const FIVE_MINUTES = 5 * 60 * 1000;

    try {
      const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>(
        (resolve, reject) => {
          execFile(
            scriptPath,
            [],
            {
              timeout: FIVE_MINUTES,
              cwd: process.cwd(),
              env: { ...process.env, CLAUDECODE: undefined },
            },
            (error, stdout, stderr) => {
              if (error) {
                reject(error);
                return;
              }
              resolve({ stdout, stderr });
            },
          );
        },
      );

      if (stdout) this.logger.log(`Analysis stdout: ${stdout}`);
      if (stderr) this.logger.warn(`Analysis stderr: ${stderr}`);
      this.logger.log('Morning analysis script completed successfully');
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Morning analysis script failed: ${error.message}`, error.stack);
    }
  }

  // 9:00 AM IST Mon-Fri: Broadcast signals + auto-trade
  @Cron('0 9 * * 1-5', { timeZone: 'Asia/Kolkata' })
  async morningSignalBroadcast(): Promise<void> {
    this.logger.log('Running morning signal broadcast...');

    try {
      let signals = await this.signalEngineService.getTodaySignals();

      // Retry once after 30s if no signals yet (file watcher may still be importing)
      if (signals.length === 0) {
        this.logger.log('No signals found, waiting 30s for file watcher to finish importing...');
        await new Promise((resolve) => setTimeout(resolve, 30_000));
        signals = await this.signalEngineService.getTodaySignals();
      }

      if (signals.length === 0) {
        this.logger.log('No signals to broadcast after retry');
        return;
      }

      const message = this.telegramBotService.formatDailySignals(signals);
      await this.telegramBotService.broadcastMessage(message);

      // Send market intelligence as a separate message
      const analysisMessage = this.telegramBotService.formatMarketIntelligence(signals);
      await this.telegramBotService.broadcastMessage(analysisMessage);

      // Auto-trade for enabled users
      await this.portfolioService.autoExecuteSignals(signals);

      this.logger.log(`Broadcast ${signals.length} signals with market intelligence and executed auto-trades`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Morning broadcast failed: ${error.message}`, error.stack);
    }
  }

  // 3:45 PM IST Mon-Fri: Daily P&L report + snapshots
  @Cron('45 15 * * 1-5', { timeZone: 'Asia/Kolkata' })
  async endOfDayReport(): Promise<void> {
    this.logger.log('Running end-of-day report...');

    try {
      const portfolios = await this.portfolioService.getAllPortfolios();

      for (const portfolio of portfolios) {
        try {
          await this.portfolioService.takeSnapshot(portfolio.telegramUserId);

          const summary = await this.portfolioService.getPortfolioSummary(
            portfolio.telegramUserId,
          );
          const pnl = await this.portfolioService.getDailyPnL(portfolio.telegramUserId);

          const pnlEmoji = pnl.todayPnl >= 0 ? '📈' : '📉';
          const message =
            `${pnlEmoji} <b>End of Day Report</b>\n\n` +
            `💰 Portfolio Value: ₹${summary.totalValue.toLocaleString('en-IN')}\n` +
            `📊 Today's P&amp;L: ₹${pnl.todayPnl.toLocaleString('en-IN')} (${pnl.todayPnlPercent >= 0 ? '+' : ''}${pnl.todayPnlPercent.toFixed(2)}%)\n` +
            `🔄 Trades Today: ${pnl.todayTrades.length}\n` +
            `📦 Holdings: ${summary.holdings.length} stocks`;

          await this.telegramBotService.sendToUser(portfolio.telegramUserId, message);
        } catch (err) {
          const error = err as Error;
          this.logger.warn(
            `Failed EOD report for user ${portfolio.telegramUserId}: ${error.message}`,
          );
        }
      }

      this.logger.log(`Completed EOD reports for ${portfolios.length} portfolios`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`End of day report failed: ${error.message}`, error.stack);
    }
  }

  // Saturday 10 AM IST: Weekly accuracy digest
  @Cron('0 10 * * 6', { timeZone: 'Asia/Kolkata' })
  async weeklyDigest(): Promise<void> {
    this.logger.log('Running weekly accuracy digest...');

    try {
      const stats = await this.signalEngineService.getPerformanceStats();
      const weekSignals = await this.signalEngineService.getSignalHistory(7);

      let typeBreakdown = '';
      for (const [type, data] of Object.entries(stats.byType)) {
        const emoji = type === 'IMPULSE' ? '⚡' : '🏦';
        typeBreakdown += `${emoji} ${type}: ${data.accurate}/${data.total} (${data.rate.toFixed(1)}%)\n`;
      }

      const message =
        `📊 <b>Weekly Signal Digest</b>\n\n` +
        `📈 Signals This Week: ${weekSignals.length}\n` +
        `✅ Overall Accuracy: ${stats.accuracyRate.toFixed(1)}%\n` +
        `📋 Total Resolved: ${stats.resolved}\n\n` +
        `<b>By Type:</b>\n${typeBreakdown}`;

      await this.telegramBotService.broadcastMessage(message);
      this.logger.log('Weekly digest sent');
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Weekly digest failed: ${error.message}`, error.stack);
    }
  }

  // 1st of month 10 AM IST: Monthly comprehensive report
  @Cron('0 10 1 * *', { timeZone: 'Asia/Kolkata' })
  async monthlyReport(): Promise<void> {
    this.logger.log('Running monthly comprehensive report...');

    try {
      const stats = await this.signalEngineService.getPerformanceStats();
      const monthSignals = await this.signalEngineService.getSignalHistory(30);

      const impulseSignals = monthSignals.filter((s) => s.tradeType === TradeType.IMPULSE);
      const longTermSignals = monthSignals.filter((s) => s.tradeType === TradeType.LONG_TERM);

      const message =
        `📅 <b>Monthly Performance Report</b>\n\n` +
        `📊 Total Signals: ${monthSignals.length}\n` +
        `⚡ Impulse Signals: ${impulseSignals.length}\n` +
        `🏦 Long-Term Signals: ${longTermSignals.length}\n\n` +
        `<b>Accuracy Breakdown:</b>\n` +
        `✅ Overall: ${stats.accuracyRate.toFixed(1)}%\n` +
        `⚡ Impulse: ${stats.byType[TradeType.IMPULSE]?.rate.toFixed(1) || 'N/A'}%\n` +
        `🏦 Long-Term: ${stats.byType[TradeType.LONG_TERM]?.rate.toFixed(1) || 'N/A'}%\n\n` +
        `📈 Total Resolved: ${stats.resolved}\n` +
        `✅ Accurate: ${stats.accurate}`;

      await this.telegramBotService.broadcastMessage(message);

      // Send individual portfolio reports
      const portfolios = await this.portfolioService.getAllPortfolios();
      for (const portfolio of portfolios) {
        try {
          const summary = await this.portfolioService.getPortfolioSummary(
            portfolio.telegramUserId,
          );

          const portfolioMessage =
            `💼 <b>Your Monthly Portfolio Report</b>\n\n` +
            `💰 Total Value: ₹${summary.totalValue.toLocaleString('en-IN')}\n` +
            `📊 P&amp;L: ₹${summary.pnlAbsolute.toLocaleString('en-IN')} (${summary.pnlPercent >= 0 ? '+' : ''}${summary.pnlPercent.toFixed(2)}%)\n` +
            `🔄 Total Trades: ${summary.totalTrades}\n` +
            `📦 Active Holdings: ${summary.holdings.length}`;

          await this.telegramBotService.sendToUser(portfolio.telegramUserId, portfolioMessage);
        } catch (err) {
          const error = err as Error;
          this.logger.warn(
            `Failed monthly report for user ${portfolio.telegramUserId}: ${error.message}`,
          );
        }
      }

      this.logger.log('Monthly report completed');
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Monthly report failed: ${error.message}`, error.stack);
    }
  }
}
