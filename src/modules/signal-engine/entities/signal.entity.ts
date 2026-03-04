import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { SignalType } from '@common/enums/signal-type.enum';
import { TradeType } from '@common/enums/trade-type.enum';

@Entity('signals')
export class Signal {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: 20, enum: SignalType, name: 'signal_type' })
  signalType: SignalType;

  @Index()
  @Column({ type: 'varchar', length: 20, enum: TradeType, name: 'trade_type' })
  tradeType: TradeType;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'current_price' })
  currentPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'target_price' })
  targetPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'stop_loss' })
  stopLoss: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'risk_reward_ratio' })
  riskRewardRatio: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'position_size_pct', default: 5.0 })
  positionSizePct: number;

  @Column({ type: 'jsonb', nullable: true })
  technicals: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  sentiment: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  reasoning: string | null;

  @Column({ type: 'int', name: 'validation_iterations', default: 1 })
  validationIterations: number;

  @Column({ type: 'jsonb', nullable: true, name: 'validation_log' })
  validationLog: Record<string, unknown>[] | null;

  @Column({ type: 'text', nullable: true, name: 'market_summary' })
  marketSummary: string | null;

  @Index()
  @Column({ type: 'boolean', name: 'outcome_resolved', default: false })
  outcomeResolved: boolean;

  @Column({ type: 'boolean', name: 'was_accurate', nullable: true, default: null })
  wasAccurate: boolean | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'actual_outcome_price',
    nullable: true,
    default: null,
  })
  actualOutcomePrice: number | null;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
