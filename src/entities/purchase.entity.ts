import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Product } from './product.entity';

export enum PurchaseProvider {
  REVCAT = 'REVCAT',
}

export enum PurchaseStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

const DATE_TYPE = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';

@Entity({ name: 'purchases' })
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.purchases)
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Product)
  product: Product;

  @Column()
  productId: string;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'text' : 'enum',
    enum: PurchaseProvider,
  } as any)
  provider: PurchaseProvider;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'text' : 'enum',
    enum: PurchaseStatus,
  } as any)
  status: PurchaseStatus;

  @Column({ unique: true })
  @Index({ unique: true })
  transactionId: string;

  @Column({ type: DATE_TYPE })
  purchasedAt: Date;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb',
    nullable: true,
  } as any)
  rawEvent: any;

  @CreateDateColumn()
  createdAt: Date;
}
