# Stock Signal Bot — Full Project Specification

## Overview
Build a complete NestJS + PostgreSQL + Telegraf Telegram bot for Indian stock market (NSE/BSE) signals with a virtual portfolio tracker and React dashboard.

## Architecture
- **Analysis Engine**: Shell script (`scripts/run-analysis.sh`) that invokes Claude Code in `-p` (non-interactive) mode with a multi-agent prompt. Runs via cron at 8:30 AM and 12:30 PM IST on weekdays.
- **NestJS Bot**: Always-running service that watches for signal JSON files, imports them into PostgreSQL, broadcasts via Telegram, manages virtual portfolios, and serves a REST API for the dashboard.
- **React Dashboard**: Separate app on port 3001 for equity curves, trade history, and signal analysis.

## The Multi-Agent System (runs inside Claude Code via -p flag)
The analysis prompt instructs Claude Code to act as 4 agents sequentially:
1. **QUANT** — Searches web for current NIFTY 50 prices, computes RSI/MACD/Bollinger/MA
2. **SENTINEL** — Searches web for news, FII/DII data, earnings, insider trading
3. **ORACLE** — Synthesizes technicals + sentiment into composite signals using weighted scoring (MACD 30%, RSI 25%, MA 25%, BB 20%)
4. **TRADER** — Classifies signals as IMPULSE (1-5 day, momentum) or LONG_TERM (weeks+, value)

### Self-Validation Loop (max 6 iterations per signal):
For each signal, ask 5 questions:
- Q1: Is data fresh and reliable?
- Q2: Do technicals and news agree?
- Q3: What's the biggest invalidation risk?
- Q4: Is risk/reward >= 2:1?
- Q5: Would I bet ₹1L real money on this?
If ANY answer is NO → revise and retry. Each iteration reduces confidence by 10%.

Output: JSON file written to `data/signals/signals_YYYY-MM-DD_HHMM.json`

## NestJS Modules (use layered architecture with separate entities/services/controllers, PostgreSQL via TypeORM)

### MarketDataModule
- Entity: `stock_prices` (symbol, name, date, OHLCV, volume)
- Service: Save prices from analysis output, get historical prices, get latest price

### SignalEngineModule
- Entity: `signals` (symbol, name, signal enum, tradeType enum, confidence, currentPrice, targetPrice, stopLoss, riskRewardRatio, positionSizePct, technicals JSON, sentiment JSON, reasoning text, validationIterations int, validationLog JSON, marketSummary, outcomeResolved bool, wasAccurate bool, actualOutcomePrice)
- Service: Import analysis JSON, get today's signals, get by type (IMPULSE/LONG_TERM), performance stats, resolve outcomes
- **SignalFileWatcherService**: Uses `fs.watch` on `data/signals/` directory. When `.new_signals` trigger file appears, reads latest signal JSON, parses it (handles markdown wrapping), imports via SignalEngineService

### PortfolioModule
- Entities: `portfolios` (telegramUserId, initialCapital=10L, cashBalance, autoTradeEnabled), `trades` (portfolioId, symbol, action BUY/SELL, tradeType IMPULSE/LONG_TERM, quantity, price, totalValue, source manual/auto_signal, signalId, targetPrice, stopLoss), `portfolio_snapshots` (portfolioId, totalValue, cashBalance, holdingsValue, pnlPercent, pnlAbsolute, holdings JSON, totalTrades, winningTrades)
- Service: getOrCreatePortfolio, executeTrade (validates cash/holdings), autoExecuteSignals (max 5 per day, position size from signal), getHoldings (computed from trade history), getPortfolioSummary, toggleAutoTrade, getDailyPnL, takeSnapshot, getEquityCurve, getTradeHistory

### TelegramBotModule
- Commands: /start, /help, /signals, /impulse, /longterm, /portfolio, /trade BUY|SELL SYMBOL QTY, /pnl, /auto, /performance, /analyze SYMBOL
- TelegramBotService: formatDailySignals (with validation info, trade type emojis ⚡🏦), formatPerformance

### SchedulerModule
- 9:00 AM IST Mon-Fri: Broadcast signals + auto-trade for enabled users
- 3:45 PM IST Mon-Fri: Daily P&L report + portfolio snapshots
- Saturday 10 AM: Weekly accuracy digest
- 1st of month 10 AM: Monthly comprehensive report with impulse vs long-term breakdown

### DashboardModule
- REST Controller at /api prefix
- GET /api/signals/today, /api/signals/history?days=30, /api/performance
- GET /api/portfolio/:userId, /api/portfolio/:userId/equity-curve, /api/portfolio/:userId/trades

## Enums
- SignalType: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
- TradeAction: BUY, SELL
- TradeType: IMPULSE, LONG_TERM

## Scripts
- `scripts/run-analysis.sh` — The master analysis prompt sent to `claude -p`. Outputs JSON to data/signals/
- `scripts/setup-cron.sh` — Installs cron jobs (8:30 AM + 12:30 PM IST weekdays)
- `scripts/seed-data.sh` — Initial historical data seed via Claude Code

## Config Files
- .env.example with: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_USER_ID, DB_*, DEFAULT_VIRTUAL_CAPITAL=1000000, SIGNALS_OUTPUT_DIR=./data/signals, MAX_VALIDATION_ITERATIONS=6
- Standard NestJS: tsconfig.json (with @common/@modules/@config path aliases), nest-cli.json, tsconfig.build.json
- Docker: Dockerfile + docker-compose.yml (postgres + bot services)
- init-database.sql

## Key Technical Decisions
- Use `yahoo-finance2` npm package as data reference (but primary data comes from Claude Code web searches)
- Use `technicalindicators` npm package for any local technical calculations
- Use `rss-parser` for Google News RSS parsing
- Use `cheerio` for HTML parsing
- ConfigModule with registerAs for typed config access
- All cron jobs use Asia/Kolkata timezone
- Enable CORS for localhost:3001 (React dashboard)
- PostgreSQL (Supabase-compatible) via TypeORM, synchronize in dev, migrations in production
