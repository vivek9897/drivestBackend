import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Purchase } from './purchase.entity';

export enum EntitlementScope {
  GLOBAL = 'GLOBAL',
  CENTRE = 'CENTRE',
}

const DATE_TYPE = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';

@Entity({ name: 'entitlements' })
@Index(['userId', 'centreId', 'endsAt'])
export class Entitlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.entitlements)
  user: User;

  @Column()
  userId: string;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'text' : 'enum',
    enum: EntitlementScope,
  } as any)
  scope: EntitlementScope;

  @Column({ type: 'varchar', nullable: true })
  centreId: string | null;

  @Column({ type: DATE_TYPE })
  startsAt: Date;

  @Column({ type: DATE_TYPE, nullable: true })
  endsAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Purchase)
  sourcePurchase: Purchase;

  @Column({ nullable: true })
  sourcePurchaseId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
