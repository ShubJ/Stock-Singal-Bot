import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('stock_prices')
@Unique(['symbol', 'date'])
export class StockPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  open: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  high: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  low: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  close: number;

  @Column({ type: 'bigint', default: 0 })
  volume: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
