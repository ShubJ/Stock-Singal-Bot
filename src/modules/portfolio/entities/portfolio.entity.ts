import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { Trade } from './trade.entity';
import { PortfolioSnapshot } from './portfolio-snapshot.entity';

@Entity('portfolios')
export class Portfolio {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 50, unique: true, name: 'telegram_user_id' })
  telegramUserId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'initial_capital', default: 1000000 })
  initialCapital: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'cash_balance', default: 1000000 })
  cashBalance: number;

  @Column({ type: 'boolean', name: 'auto_trade_enabled', default: false })
  autoTradeEnabled: boolean;

  @OneToMany(() => Trade, (trade) => trade.portfolio)
  trades: Trade[];

  @OneToMany(() => PortfolioSnapshot, (snapshot) => snapshot.portfolio)
  snapshots: PortfolioSnapshot[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
