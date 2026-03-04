CREATE DATABASE IF NOT EXISTS stock_signal_bot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stock_signal_bot;

CREATE TABLE IF NOT EXISTS stock_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12, 2) NOT NULL,
    high DECIMAL(12, 2) NOT NULL,
    low DECIMAL(12, 2) NOT NULL,
    close DECIMAL(12, 2) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_symbol_date (symbol, date),
    INDEX idx_symbol (symbol),
    INDEX idx_date (date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS signals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    signal_type ENUM('STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL') NOT NULL,
    trade_type ENUM('IMPULSE', 'LONG_TERM') NOT NULL,
    confidence DECIMAL(5, 2) NOT NULL,
    current_price DECIMAL(12, 2) NOT NULL,
    target_price DECIMAL(12, 2) NOT NULL,
    stop_loss DECIMAL(12, 2) NOT NULL,
    risk_reward_ratio DECIMAL(5, 2) NOT NULL,
    position_size_pct DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    technicals JSON,
    sentiment JSON,
    reasoning TEXT,
    validation_iterations INT NOT NULL DEFAULT 1,
    validation_log JSON,
    market_summary TEXT,
    outcome_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    was_accurate BOOLEAN DEFAULT NULL,
    actual_outcome_price DECIMAL(12, 2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_symbol (symbol),
    INDEX idx_signal_type (signal_type),
    INDEX idx_trade_type (trade_type),
    INDEX idx_created_at (created_at),
    INDEX idx_outcome (outcome_resolved, was_accurate)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS portfolios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_user_id VARCHAR(50) NOT NULL UNIQUE,
    initial_capital DECIMAL(14, 2) NOT NULL DEFAULT 1000000.00,
    cash_balance DECIMAL(14, 2) NOT NULL DEFAULT 1000000.00,
    auto_trade_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_telegram_user (telegram_user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id INT NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action ENUM('BUY', 'SELL') NOT NULL,
    trade_type ENUM('IMPULSE', 'LONG_TERM') NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    total_value DECIMAL(14, 2) NOT NULL,
    source ENUM('manual', 'auto_signal') NOT NULL DEFAULT 'manual',
    signal_id INT DEFAULT NULL,
    target_price DECIMAL(12, 2) DEFAULT NULL,
    stop_loss DECIMAL(12, 2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_portfolio (portfolio_id),
    INDEX idx_symbol (symbol),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_trades_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
    CONSTRAINT fk_trades_signal FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id INT NOT NULL,
    total_value DECIMAL(14, 2) NOT NULL,
    cash_balance DECIMAL(14, 2) NOT NULL,
    holdings_value DECIMAL(14, 2) NOT NULL,
    pnl_percent DECIMAL(8, 4) NOT NULL DEFAULT 0.0000,
    pnl_absolute DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    holdings JSON,
    total_trades INT NOT NULL DEFAULT 0,
    winning_trades INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_portfolio (portfolio_id),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_snapshots_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
) ENGINE=InnoDB;
