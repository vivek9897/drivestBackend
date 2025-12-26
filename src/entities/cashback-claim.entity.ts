import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum CashbackStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

const DATE_TYPE = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';

@Entity({ name: 'cashback_claims' })
export class CashbackClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.cashbackClaims)
  user: User;

  @Column({ unique: true })
  userId: string;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'text' : 'enum',
    enum: CashbackStatus,
    default: CashbackStatus.PENDING,
  } as any)
  status: CashbackStatus;

  @Column({ type: 'int', default: 200 })
  amountPence: number;

  @Column({ default: false })
  suspicious: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: DATE_TYPE, nullable: true })
  approvedAt: Date | null;

  @Column({ type: DATE_TYPE, nullable: true })
  paidAt: Date | null;

  @Column({ type: DATE_TYPE, nullable: true })
  testScheduledAt: Date | null;

  @Column({ type: DATE_TYPE, nullable: true })
  reminderSentAt: Date | null;
}
