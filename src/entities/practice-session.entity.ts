import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Route } from './route.entity';

@Entity({ name: 'practice_sessions' })
@Index(['userId', 'routeId'])
export class PracticeSession {
  private static DATE_TYPE = process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.sessions)
  user: User;

  @Column()
  routeId: string;

  @ManyToOne(() => Route, (route) => route.sessions)
  route: Route;

  @Column({ type: PracticeSession.DATE_TYPE } as any)
  startedAt: Date;

  @Column({ type: PracticeSession.DATE_TYPE, nullable: true } as any)
  endedAt: Date | null;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'int', nullable: true })
  distanceM: number | null;

  @Column({ type: 'int', nullable: true })
  durationS: number | null;

  @Column({ type: 'int', nullable: true })
  xpEarned: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
