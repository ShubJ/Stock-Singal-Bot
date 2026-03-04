# Stock Signal Bot

AI-powered Indian stock market (NSE/BSE) signal generator with a virtual portfolio tracker and Telegram bot interface. Uses Claude Code as a multi-agent analysis engine to produce daily BUY/SELL signals for NIFTY 50 stocks, complete with technical indicators, sentiment analysis, and a self-validation loop.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Step-by-Step Setup](#step-by-step-setup)
  - [1. Clone and Install](#1-clone-and-install)
  - [2. Create a Telegram Bot](#2-create-a-telegram-bot)
  - [3. Install and Configure Claude Code CLI](#3-install-and-configure-claude-code-cli)
  - [4. Set Up PostgreSQL Database](#4-set-up-postgresql-database)
  - [5. Configure Environment Variables](#5-configure-environment-variables)
  - [6. Initialize the Database Schema](#6-initialize-the-database-schema)
  - [7. Run the Application](#7-run-the-application)
  - [8. Set Up Cron Jobs](#8-set-up-cron-jobs)
  - [9. Seed Historical Data (Optional)](#9-seed-historical-data-optional)
- [Running with Docker](#running-with-docker)
- [How It Works](#how-it-works)
- [Telegram Bot Commands](#telegram-bot-commands)
- [REST API Endpoints](#rest-api-endpoints)
- [Project Structure](#project-structure)
- [Scheduled Jobs](#scheduled-jobs)
- [Configuration Reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The system has three main components:

```
┌─────────────────────┐      JSON files       ┌────────────────────────┐
│  Analysis Engine     │ ───────────────────>  │  NestJS Bot Service    │
│  (run-analysis.sh)   │   data/signals/       │  (always running)      │
│  Claude Code -p      │   + .new_signals      │                        │
│                      │   trigger file        │  - File Watcher        │
│  4 Agents:           │                       │  - Telegram Bot        │
│  QUANT -> SENTINEL   │                       │  - Portfolio Manager   │
│  -> ORACLE -> TRADER │                       │  - Scheduler           │
└─────────────────────┘                        │  - REST API            │
       ^                                       └──────────┬─────────────┘
       │ cron (8:30 AM + 12:30 PM IST)                    │
       │                                                   │ port 3000
       │                                         ┌────────┴─────────────┐
  ┌────┴─────────┐                                │  React Dashboard     │
  │  Cron Daemon │                                │  (port 3001)         │
  └──────────────┘                                └──────────────────────┘
```

1. **Analysis Engine** (`scripts/run-analysis.sh`): Shell script that invokes Claude Code in non-interactive (`-p`) mode. A multi-agent prompt instructs Claude to act as 4 sequential agents (QUANT, SENTINEL, ORACLE, TRADER) that analyze NIFTY 50 stocks and produce validated signals. Output is written as JSON to `data/signals/`.

2. **NestJS Bot Service**: Always-running Node.js application that watches for new signal files, imports them into MySQL, broadcasts via Telegram, manages virtual portfolios (10L starting capital), and exposes a REST API for the dashboard.

3. **React Dashboard** (separate app, not included here): Connects to the REST API on port 3000 to display equity curves, trade history, and signal analysis.

---

## Prerequisites

You need the following installed on your system before starting:

| Requirement | Minimum Version | How to Check | Install Guide |
|---|---|---|---|
| **Node.js** | v18.0.0+ | `node --version` | [nodejs.org](https://nodejs.org/) or `brew install node` |
| **npm** | v9.0.0+ | `npm --version` | Comes with Node.js |
| **PostgreSQL** | 14+ | `psql --version` | See [Step 4](#4-set-up-postgresql-database) |
| **Claude Code CLI** | Latest | `claude --version` | See [Step 3](#3-install-and-configure-claude-code-cli) |
| **Docker** (optional) | 20.0+ | `docker --version` | [docker.com](https://docs.docker.com/get-docker/) |
| **Docker Compose** (optional) | v2.0+ | `docker compose version` | Comes with Docker Desktop |

### Operating System

- macOS (tested)
- Linux (compatible)
- Windows via WSL2 (should work, not tested)

---

## Step-by-Step Setup

### 1. Clone and Install

```bash
# Navigate to the project directory
cd stock-signal-bot

# Install all Node.js dependencies
npm install
```

This installs all required packages including:
- NestJS framework + TypeORM + PostgreSQL driver
- Telegraf (Telegram bot library)
- yahoo-finance2 (market data reference)
- technicalindicators (local TA computations)
- rss-parser + cheerio (news parsing)

Verify the installation succeeded:

```bash
# Should compile with zero errors
npx tsc --noEmit
```

### 2. Create a Telegram Bot

You need a Telegram bot token to use the bot features.

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a display name (e.g., `Stock Signal Bot`)
4. Choose a username (must end in `bot`, e.g., `my_stock_signals_bot`)
5. BotFather will reply with your **bot token** — it looks like `123456789:ABCdefGhIjKlMnOpQrStUvWxYz`
6. **Save this token** — you will need it for the `.env` file

To find your **Telegram user ID** (needed for admin features):

1. Search for **@userinfobot** on Telegram
2. Send any message to it
3. It will reply with your user ID (a number like `123456789`)

### 3. Install and Configure Claude Code CLI

The analysis engine requires Claude Code CLI to run the multi-agent analysis prompt.

#### Install Claude Code

```bash
# Install globally via npm
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

#### Authenticate

```bash
# This opens a browser for authentication
claude auth login
```

Follow the prompts to authenticate with your Anthropic account. You need an active API key or Claude Pro/Team subscription.

#### Verify It Works

```bash
# Quick test — should return a response
claude -p "Say hello"
```

#### Find the Claude Binary Path

```bash
# Note the path for your .env file
which claude
# Typical output: /usr/local/bin/claude or /opt/homebrew/bin/claude
```

### 4. Set Up PostgreSQL Database

You have two options: install PostgreSQL locally, use Docker, or use **Supabase** (hosted PostgreSQL).

#### Option A: PostgreSQL via Docker (Recommended for local dev)

```bash
# Start only the PostgreSQL service from docker-compose
docker compose up postgres -d

# Verify it's running
docker compose ps

# Check the logs
docker compose logs postgres
```

PostgreSQL will be available at `localhost:5432` with:
- Database: `stock_signal_bot`
- Username: `stockbot`
- Password: `stockbot_secret`

The `init-database.sql` file runs automatically on first start and creates all tables.

#### Option B: Use Supabase (Recommended for production)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings > Database** to find your connection details
3. Update `.env` with your Supabase credentials:

```env
DB_HOST=db.<your-project-ref>.supabase.co
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<your-supabase-db-password>
DB_DATABASE=postgres
```

4. Run the init script via Supabase SQL Editor or `psql`:

```bash
psql "postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" -f init-database.sql
```

#### Option C: Install PostgreSQL Locally

**macOS (Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Create the database and user:**

```sql
-- Log into PostgreSQL as superuser
sudo -u postgres psql

-- Create user
CREATE USER stockbot WITH PASSWORD 'stockbot_secret';

-- Create database
CREATE DATABASE stock_signal_bot OWNER stockbot;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE stock_signal_bot TO stockbot;

-- Exit
\q
```

### 5. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env
```

Open `.env` in your editor and fill in the values:

```env
# Telegram — paste the token from BotFather
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIjKlMnOpQrStUvWxYz

# Telegram — your user ID from @userinfobot
TELEGRAM_ADMIN_USER_ID=123456789

# Database — update if you changed the defaults (or use Supabase credentials)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=stockbot
DB_PASSWORD=stockbot_secret
DB_DATABASE=stock_signal_bot

# Application
NODE_ENV=development
PORT=3000
DEFAULT_VIRTUAL_CAPITAL=1000000
SIGNALS_OUTPUT_DIR=./data/signals
MAX_VALIDATION_ITERATIONS=6

# Analysis — update with output of `which claude`
CLAUDE_PATH=/usr/local/bin/claude
```

### 6. Initialize the Database Schema

If you used **Docker** (Option A) or **Supabase** (Option B with SQL Editor), the schema is already created. Skip this step.

If you installed PostgreSQL **locally** (Option C), run the init script:

```bash
psql -U stockbot -d stock_signal_bot -f init-database.sql
```

Verify the tables were created:

```bash
psql -U stockbot -d stock_signal_bot -c "\dt"
```

Expected output:

```
             List of relations
 Schema |        Name          | Type  | Owner
--------+----------------------+-------+---------
 public | portfolio_snapshots  | table | stockbot
 public | portfolios           | table | stockbot
 public | signals              | table | stockbot
 public | stock_prices         | table | stockbot
 public | trades               | table | stockbot
```

### 7. Run the Application

#### Development Mode (with hot reload)

```bash
npm run start:dev
```

You should see output like:

```
[Nest] LOG [Bootstrap] Application running on port 3000
[Nest] LOG [Bootstrap] Swagger docs available at http://localhost:3000/docs
[Nest] LOG [SignalFileWatcherService] Watching for signal files in: ./data/signals
[Nest] LOG [TelegramBotService] Telegram bot started
```

#### Production Mode

```bash
# Build first
npm run build

# Run the compiled output
npm run start:prod
```

#### Verify Everything Is Working

1. **API**: Open [http://localhost:3000/docs](http://localhost:3000/docs) in your browser to see the Swagger documentation
2. **Telegram**: Open your bot in Telegram and send `/start` — you should get a welcome message
3. **File watcher**: Check the console logs for `Watching for signal files in: ./data/signals`

### 8. Set Up Cron Jobs

The analysis engine runs on a schedule via cron. The script sets up two daily runs on weekdays:

```bash
# Install the cron jobs
./scripts/setup-cron.sh
```

This installs:
- **8:30 AM IST** (Mon-Fri): Morning analysis before market opens
- **12:30 PM IST** (Mon-Fri): Midday analysis during trading hours

To verify:

```bash
crontab -l
```

To run the analysis **manually** (for testing):

```bash
./scripts/run-analysis.sh
```

This takes 1-3 minutes depending on Claude's response time. Check the output:

```bash
ls -la data/signals/
```

You should see a file like `signals_2026-02-26_0830.json`.

### 9. Seed Historical Data (Optional)

To populate the database with recent price history for NIFTY 50 stocks:

```bash
./scripts/seed-data.sh
```

This uses Claude Code to fetch the last 5 trading days of OHLCV data for 20 NIFTY 50 stocks and imports it via the file watcher.

---

## Running with Docker

To run the entire stack (PostgreSQL + NestJS bot) with Docker:

```bash
# Create your .env file first (Step 5 above)
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_USER_ID

# Build and start everything
docker compose up -d

# Check the logs
docker compose logs -f bot

# Stop everything
docker compose down

# Stop and remove all data (including the database)
docker compose down -v
```

The Docker setup:
- PostgreSQL runs in `stockbot-postgres` container with persistent volume
- The bot runs in `stockbot-app` container
- `init-database.sql` creates all tables on first PostgreSQL start
- `data/signals/` is mounted as a volume so the analysis script (running on host) can write signal files that the containerized bot picks up

**Important**: The analysis script (`run-analysis.sh`) runs on the **host machine** via cron (not inside Docker), because it needs access to Claude Code CLI. The signal JSON files are shared via the volume mount.

---

## How It Works

### The Multi-Agent Analysis Pipeline

When `run-analysis.sh` executes (via cron or manually), it sends a detailed prompt to Claude Code. The prompt instructs Claude to act as 4 sequential agents:

| Agent | Role | What It Does |
|---|---|---|
| **QUANT** | Technical Analyst | Searches web for NIFTY 50 prices, computes RSI, MACD, Bollinger Bands, Moving Averages |
| **SENTINEL** | News Analyst | Searches web for FII/DII data, earnings, breaking news, insider trading |
| **ORACLE** | Signal Synthesizer | Combines technicals + sentiment using weighted scoring (MACD 30%, RSI 25%, MA 25%, BB 20%) |
| **TRADER** | Classifier & Validator | Classifies as IMPULSE/LONG_TERM, runs 5-question self-validation loop (max 6 iterations) |

### Self-Validation Loop

Each signal goes through a validation loop where 5 questions must all be answered YES:

1. Is the data fresh and reliable?
2. Do technicals and news agree?
3. What's the biggest invalidation risk?
4. Is risk/reward >= 2:1?
5. Would I bet 1L real money on this?

If any answer is NO, the signal is revised and confidence drops by 10% per iteration. After 6 failed iterations, the signal is downgraded to HOLD.

### Signal Flow

```
run-analysis.sh
    │
    ├── Claude Code generates JSON
    │
    ├── Writes to data/signals/signals_YYYY-MM-DD_HHMM.json
    │
    ├── Creates trigger file data/signals/.new_signals
    │
    └── SignalFileWatcherService (NestJS) detects trigger
            │
            ├── Parses JSON (handles markdown wrapping)
            │
            ├── Saves prices to stock_prices table
            │
            ├── Saves signals to signals table
            │
            └── Scheduler broadcasts to Telegram + auto-trades
```

---

## Telegram Bot Commands

| Command | Description |
|---|---|
| `/start` | Initialize your portfolio (10L virtual capital) and subscribe to signals |
| `/help` | List all available commands |
| `/signals` | View today's stock signals with confidence scores |
| `/impulse` | Short-term momentum signals only (1-5 day holds) |
| `/longterm` | Long-term value signals only (weeks to months) |
| `/portfolio` | View your virtual portfolio summary, holdings, and P&L |
| `/trade BUY\|SELL SYMBOL QTY` | Execute a manual trade (e.g., `/trade BUY RELIANCE 10`) |
| `/pnl` | Today's profit and loss |
| `/auto` | Toggle auto-trading on/off (max 5 trades/day when enabled) |
| `/performance` | Signal accuracy statistics with IMPULSE vs LONG_TERM breakdown |
| `/analyze SYMBOL` | View the latest analysis for a specific stock |

---

## REST API Endpoints

All endpoints are prefixed with `/api`. Swagger docs are available at `/docs`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/signals/today` | Today's signals |
| GET | `/api/signals/history?days=30` | Signal history for the last N days |
| GET | `/api/performance` | Signal accuracy stats |
| GET | `/api/portfolio/:userId` | Portfolio summary for a user |
| GET | `/api/portfolio/:userId/equity-curve` | Equity curve (daily snapshots) |
| GET | `/api/portfolio/:userId/trades?limit=50` | Trade history for a user |

---

## Project Structure

```
stock-signal-bot/
├── data/
│   └── signals/                    # Analysis output JSON files land here
├── scripts/
│   ├── run-analysis.sh             # Multi-agent Claude Code analysis prompt
│   ├── setup-cron.sh               # Install cron jobs for scheduled analysis
│   └── seed-data.sh                # Seed historical price data
├── src/
│   ├── main.ts                     # App bootstrap, CORS, Swagger, global pipes
│   ├── app.module.ts               # Root module wiring all feature modules
│   ├── common/
│   │   ├── config/
│   │   │   ├── app.config.ts       # Application config (registerAs)
│   │   │   ├── database.config.ts  # MySQL connection config
│   │   │   ├── telegram.config.ts  # Bot token config
│   │   │   └── typeorm.config.ts   # TypeORM CLI migration config
│   │   ├── enums/
│   │   │   ├── signal-type.enum.ts # STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
│   │   │   ├── trade-action.enum.ts# BUY, SELL
│   │   │   ├── trade-type.enum.ts  # IMPULSE, LONG_TERM
│   │   │   └── trade-source.enum.ts# manual, auto_signal
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   └── types/
│   │       └── analysis-output.type.ts  # TypeScript interfaces for JSON schema
│   └── modules/
│       ├── market-data/
│       │   ├── entities/stock-price.entity.ts
│       │   ├── market-data.service.ts
│       │   └── market-data.module.ts
│       ├── signal-engine/
│       │   ├── entities/signal.entity.ts
│       │   ├── signal-engine.service.ts
│       │   ├── signal-file-watcher.service.ts
│       │   └── signal-engine.module.ts
│       ├── portfolio/
│       │   ├── entities/
│       │   │   ├── portfolio.entity.ts
│       │   │   ├── trade.entity.ts
│       │   │   └── portfolio-snapshot.entity.ts
│       │   ├── portfolio.service.ts
│       │   └── portfolio.module.ts
│       ├── telegram-bot/
│       │   ├── telegram-bot.service.ts
│       │   └── telegram-bot.module.ts
│       ├── scheduler/
│       │   ├── scheduler.service.ts
│       │   └── scheduler.module.ts
│       └── dashboard/
│           ├── dashboard.controller.ts
│           └── dashboard.module.ts
├── test/
│   └── jest-e2e.json
├── .env.example
├── .gitignore
├── .prettierrc
├── docker-compose.yml
├── Dockerfile
├── init-database.sql
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── PROJECT_SPEC.md
```

---

## Scheduled Jobs

All cron jobs use `Asia/Kolkata` timezone.

| Schedule | Job | Description |
|---|---|---|
| **9:00 AM IST Mon-Fri** | `morningSignalBroadcast` | Broadcasts today's signals to all Telegram subscribers, executes auto-trades |
| **3:45 PM IST Mon-Fri** | `endOfDayReport` | Sends daily P&L to each user, takes portfolio snapshots |
| **10:00 AM IST Saturday** | `weeklyDigest` | Weekly accuracy digest with IMPULSE vs LONG_TERM breakdown |
| **10:00 AM IST 1st of month** | `monthlyReport` | Comprehensive monthly performance report with individual portfolio summaries |

Additionally, the **analysis cron** (external to NestJS) runs:
- **8:30 AM IST Mon-Fri**: `run-analysis.sh`
- **12:30 PM IST Mon-Fri**: `run-analysis.sh`

---

## Configuration Reference

All configuration is via environment variables. Copy `.env.example` to `.env` and adjust:

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Token from @BotFather |
| `TELEGRAM_ADMIN_USER_ID` | Yes | — | Your Telegram user ID for admin broadcasts |
| `DB_HOST` | No | `localhost` | PostgreSQL hostname (or Supabase host) |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_USERNAME` | No | `stockbot` | PostgreSQL username |
| `DB_PASSWORD` | No | `stockbot_secret` | PostgreSQL password |
| `DB_DATABASE` | No | `stock_signal_bot` | PostgreSQL database name |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3000` | HTTP server port |
| `DEFAULT_VIRTUAL_CAPITAL` | No | `1000000` | Starting virtual capital in INR (10 Lakh) |
| `SIGNALS_OUTPUT_DIR` | No | `./data/signals` | Directory where analysis JSON is written |
| `MAX_VALIDATION_ITERATIONS` | No | `6` | Max self-validation loops per signal |
| `CLAUDE_PATH` | No | `/usr/local/bin/claude` | Path to Claude Code CLI binary |

---

## Troubleshooting

### "TELEGRAM_BOT_TOKEN not set, bot will not start"

The bot runs without Telegram if no token is set. This is by design — the REST API and signal processing still work. Set `TELEGRAM_BOT_TOKEN` in `.env` to enable the bot.

### "FATAL: password authentication failed" on startup

PostgreSQL credentials in `.env` don't match. Verify:

```bash
# Test PostgreSQL connection directly
psql -U stockbot -d stock_signal_bot -c "SELECT 1;"
```

If using Docker PostgreSQL:

```bash
docker compose logs postgres
```

### "Cannot find module" or path alias errors

Make sure you ran `npm install`. If the issue persists:

```bash
rm -rf node_modules dist
npm install
npm run build
```

### Analysis script produces empty output

1. Check Claude Code is authenticated: `claude auth status`
2. Test manually: `claude -p "Say hello"`
3. Check the script has execute permissions: `chmod +x scripts/run-analysis.sh`
4. Look at the raw output: `cat data/signals/signals_*.json | head -20`

### File watcher not picking up signals

1. Check the watcher is running (look for `Watching for signal files` in logs)
2. Ensure `SIGNALS_OUTPUT_DIR` matches in both `.env` and the analysis script
3. The trigger file `.new_signals` must be created *after* the JSON file is written
4. Check file permissions on the `data/signals/` directory

### Port 3000 already in use

```bash
# Find and kill the process using port 3000
lsof -i :3000
kill -9 <PID>

# Or change the port in .env
PORT=3001
```

### Docker PostgreSQL won't start (port conflict)

```bash
# Check if local PostgreSQL is running on 5432
lsof -i :5432

# Either stop local PostgreSQL
brew services stop postgresql@16

# Or change the Docker port in docker-compose.yml
ports:
  - '5433:5432'
# And update DB_PORT=5433 in .env
```

### TypeORM synchronize warnings in production

This is expected. In development, `synchronize: true` auto-creates tables. For production (or Supabase), use migrations:

```bash
# Generate a migration from entity changes
npm run migration:generate -- src/migrations/InitialSchema

# Run pending migrations
npm run migration:run
```

### How to reset everything

```bash
# Reset database (Docker)
docker compose down -v
docker compose up postgres -d

# Reset database (local)
psql -U postgres -c "DROP DATABASE stock_signal_bot;"
psql -U postgres -c "CREATE DATABASE stock_signal_bot OWNER stockbot;"
psql -U stockbot -d stock_signal_bot -f init-database.sql

# Clear signal files
rm -f data/signals/*.json data/signals/.new_signals
```
