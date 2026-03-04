import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { TradeAction } from '@common/enums/trade-action.enum';
import { TradeType } from '@common/enums/trade-type.enum';
import { TradeSource } from '@common/enums/trade-source.enum';
import { Portfolio } from './portfolio.entity';
import { Signal } from '@modules/signal-engine/entities/signal.entity';

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'portfolio_id' })
  portfolioId: number;

  @ManyToOne(() => Portfolio, (portfolio) => portfolio.trades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portfolio_id' })
  portfolio: Portfolio;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 20, enum: TradeAction })
  action: TradeAction;

  @Column({ type: 'varchar', length: 20, enum: TradeType, name: 'trade_type' })
  tradeType: TradeType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_value' })
  totalValue: number;

  @Column({ type: 'varchar', length: 20, enum: TradeSource, default: TradeSource.MANUAL })
  source: TradeSource;

  @Column({ name: 'signal_id', nullable: true })
  signalId: number | null;

  @ManyToOne(() => Signal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'signal_id' })
  signal: Signal | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'target_price', nullable: true })
  targetPrice: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'stop_loss', nullable: true })
  stopLoss: number | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
