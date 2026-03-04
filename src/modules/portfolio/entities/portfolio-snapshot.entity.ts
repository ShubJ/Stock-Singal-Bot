import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Portfolio } from './portfolio.entity';

@Entity('portfolio_snapshots')
export class PortfolioSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'portfolio_id' })
  portfolioId: number;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.snapshots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio: Portfolio;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_value' })
  totalValue: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'cash_balance' })
  cashBalance: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'holdings_value' })
  holdingsValue: number;

  @Column({ type: 'decimal', precision: 8, scale: 4, name: 'pnl_percent', default: 0 })
  pnlPercent: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'pnl_absolute', default: 0 })
  pnlAbsolute: number;

  @Column({ type: 'json', nullable: true })
  holdings: Record<string, unknown>[] | null;

  @Column({ type: 'int', name: 'total_trades', default: 0 })
  totalTrades: number;

  @Column({ type: 'int', name: 'winning_trades', default: 0 })
  winningTrades: number;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
