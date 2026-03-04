CREATE TABLE IF NOT EXISTS stock_prices (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12, 2) NOT NULL,
    high DECIMAL(12, 2) NOT NULL,
    low DECIMAL(12, 2) NOT NULL,
    close DECIMAL(12, 2) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol ON stock_prices (symbol);
CREATE INDEX IF NOT EXISTS idx_stock_prices_date ON stock_prices (date);

CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    signal_type VARCHAR(20) NOT NULL CHECK (signal_type IN ('STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL')),
    trade_type VARCHAR(20) NOT NULL CHECK (trade_type IN ('IMPULSE', 'LONG_TERM')),
    confidence DECIMAL(5, 2) NOT NULL,
    current_price DECIMAL(12, 2) NOT NULL,
    target_price DECIMAL(12, 2) NOT NULL,
    stop_loss DECIMAL(12, 2) NOT NULL,
    risk_reward_ratio DECIMAL(5, 2) NOT NULL,
    position_size_pct DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    technicals JSONB,
    sentiment JSONB,
    reasoning TEXT,
    validation_iterations INT NOT NULL DEFAULT 1,
    validation_log JSONB,
    market_summary TEXT,
    outcome_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    was_accurate BOOLEAN DEFAULT NULL,
    actual_outcome_price DECIMAL(12, 2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals (symbol);
CREATE INDEX IF NOT EXISTS idx_signals_signal_type ON signals (signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_trade_type ON signals (trade_type);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals (created_at);
CREATE INDEX IF NOT EXISTS idx_signals_outcome ON signals (outcome_resolved, was_accurate);

CREATE TABLE IF NOT EXISTS portfolios (
    id SERIAL PRIMARY KEY,
    telegram_user_id VARCHAR(50) NOT NULL UNIQUE,
    initial_capital DECIMAL(14, 2) NOT NULL DEFAULT 1000000.00,
    cash_balance DECIMAL(14, 2) NOT NULL DEFAULT 1000000.00,
    auto_trade_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_telegram_user ON portfolios (telegram_user_id);

CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    portfolio_id INT NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('BUY', 'SELL')),
    trade_type VARCHAR(20) NOT NULL CHECK (trade_type IN ('IMPULSE', 'LONG_TERM')),
    quantity INT NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    total_value DECIMAL(14, 2) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_signal')),
    signal_id INT DEFAULT NULL,
    target_price DECIMAL(12, 2) DEFAULT NULL,
    stop_loss DECIMAL(12, 2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_trades_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
    CONSTRAINT fk_trades_signal FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_portfolio ON trades (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades (created_at);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    portfolio_id INT NOT NULL,
    total_value DECIMAL(14, 2) NOT NULL,
    cash_balance DECIMAL(14, 2) NOT NULL,
    holdings_value DECIMAL(14, 2) NOT NULL,
    pnl_percent DECIMAL(8, 4) NOT NULL DEFAULT 0.0000,
    pnl_absolute DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    holdings JSONB,
    total_trades INT NOT NULL DEFAULT 0,
    winning_trades INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_snapshots_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_portfolio ON portfolio_snapshots (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON portfolio_snapshots (created_at);
