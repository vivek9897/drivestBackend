import { Column, Entity, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Route } from './route.entity';

@Entity({ name: 'route_stats' })
@Unique(['userId', 'routeId'])
export class RouteStat {
  @PrimaryColumn('uuid')
  userId: string;

  @PrimaryColumn('uuid')
  routeId: string;

  @ManyToOne(() => User, (u) => u.stats)
  user: User;

  @ManyToOne(() => Route, (r) => r.stats)
  route: Route;

  @Column({ default: 0 })
  timesCompleted: number;

  @Column({ type: 'int', nullable: true })
  bestTimeS: number | null;

  @Column({ type: process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz', nullable: true } as any)
  lastCompletedAt: Date | null;
}
