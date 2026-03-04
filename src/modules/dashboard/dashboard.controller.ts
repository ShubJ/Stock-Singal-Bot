import { Controller, Get, Post, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';

import { SignalEngineService } from '@modules/signal-engine/signal-engine.service';
import { PortfolioService } from '@modules/portfolio/portfolio.service';
import { TelegramBotService } from '@modules/telegram-bot/telegram-bot.service';

@ApiTags('Dashboard')
@Controller('api')
export class DashboardController {
  constructor(
    private readonly signalEngineService: SignalEngineService,
    private readonly portfolioService: PortfolioService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  @Get('signals/today')
  @ApiOperation({ summary: 'Get today\'s signals' })
  @ApiResponse({ status: 200, description: 'Today\'s signals retrieved successfully' })
  async getTodaySignals() {
    return this.signalEngineService.getTodaySignals();
  }

  @Get('signals/history')
  @ApiOperation({ summary: 'Get signal history' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days' })
  @ApiResponse({ status: 200, description: 'Signal history retrieved successfully' })
  async getSignalHistory(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.signalEngineService.getSignalHistory(days);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get signal performance stats' })
  @ApiResponse({ status: 200, description: 'Performance stats retrieved successfully' })
  async getPerformance() {
    return this.signalEngineService.getPerformanceStats();
  }

  @Get('portfolio/:userId')
  @ApiOperation({ summary: 'Get portfolio summary for a user' })
  @ApiParam({ name: 'userId', description: 'Telegram user ID' })
  @ApiResponse({ status: 200, description: 'Portfolio summary retrieved successfully' })
  async getPortfolio(@Param('userId') userId: string) {
    return this.portfolioService.getPortfolioSummary(userId);
  }

  @Get('portfolio/:userId/equity-curve')
  @ApiOperation({ summary: 'Get equity curve for a user' })
  @ApiParam({ name: 'userId', description: 'Telegram user ID' })
  @ApiResponse({ status: 200, description: 'Equity curve retrieved successfully' })
  async getEquityCurve(@Param('userId') userId: string) {
    return this.portfolioService.getEquityCurve(userId);
  }

  @Get('portfolio/:userId/trades')
  @ApiOperation({ summary: 'Get trade history for a user' })
  @ApiParam({ name: 'userId', description: 'Telegram user ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Trade history retrieved successfully' })
  async getTradeHistory(
    @Param('userId') userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.portfolioService.getTradeHistory(userId, limit);
  }

  @Post('broadcast/signals')
  @ApiOperation({ summary: 'Trigger signal broadcast to all subscribers' })
  @ApiResponse({ status: 200, description: 'Broadcast triggered successfully' })
  async triggerSignalBroadcast() {
    const signals = await this.signalEngineService.getTodaySignals();
    if (signals.length === 0) {
      return { status: 'no_signals', message: 'No signals found for today' };
    }

    const message = this.telegramBotService.formatDailySignals(signals);
    await this.telegramBotService.broadcastMessage(message);

    return { status: 'sent', signalCount: signals.length };
  }

  @Post('broadcast/analysis')
  @ApiOperation({ summary: 'Trigger market intelligence broadcast to all subscribers' })
  @ApiResponse({ status: 200, description: 'Market intelligence broadcast triggered successfully' })
  async triggerAnalysisBroadcast() {
    const signals = await this.signalEngineService.getTodaySignals();
    if (signals.length === 0) {
      return { status: 'no_signals', message: 'No signals found for today' };
    }

    const message = this.telegramBotService.formatMarketIntelligence(signals);
    await this.telegramBotService.broadcastMessage(message);

    return { status: 'sent', signalCount: signals.length };
  }
}
