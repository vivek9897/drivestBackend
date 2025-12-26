import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ProductType {
  CENTRE_PACK = 'CENTRE_PACK',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export enum ProductPeriod {
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  NONE = 'NONE',
}

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'text' : 'enum',
    enum: ProductType,
  } as any)
  type: ProductType;

  @Column('int')
  pricePence: number;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'text' : 'enum',
    enum: ProductPeriod,
  } as any)
  period: ProductPeriod;

  @Column()
  iosProductId: string;

  @Column()
  androidProductId: string;

  @Column({ default: true })
  active: boolean;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb',
    nullable: true,
  } as any)
  metadata?: any;
}
