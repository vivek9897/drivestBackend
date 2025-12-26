import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { Route } from './route.entity';

export enum TrackType {
  CASHBACK = 'CASHBACK',
  PRACTICE = 'PRACTICE',
}

@Entity({ name: 'tracks' })
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.tracks)
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Route, { nullable: true })
  route: Route | null;

  @Column({ nullable: true })
  routeId: string | null;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'text' : 'enum',
    enum: TrackType,
  } as any)
  type: TrackType;

  @Column({ type: 'varchar', nullable: true })
  pointsS3Key: string | null;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb',
    nullable: true,
  } as any)
  summary: any;

  @CreateDateColumn()
  createdAt: Date;
}
