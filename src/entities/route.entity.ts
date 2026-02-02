import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TestCentre } from './test-centre.entity';
import { PracticeSession } from './practice-session.entity';
import { RouteStat } from './route-stat.entity';

export enum RouteDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

@Entity({ name: 'routes' })
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  centreId: string;

  @ManyToOne(() => TestCentre, (centre) => centre.routes)
  centre: TestCentre;

  @Column()
  name: string;

  @Column('int')
  distanceM: number;

  @Column('int')
  durationEstS: number;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'text' : 'enum',
    enum: RouteDifficulty,
  } as any)
  difficulty: RouteDifficulty;

  @Column('text', { nullable: true })
  polyline: string | null;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb',
    nullable: true,
  } as any)
  coordinates: any[] | null;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb',
    nullable: true,
  } as any)
  bbox: any;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb',
    nullable: true,
  } as any)
  geojson: any | null;

  @Column({ type: 'text', nullable: true })
  gpx: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gpxHash: string | null;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb',
    nullable: true,
  } as any)
  payload: any | null;

  @Column('int')
  version: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => PracticeSession, (s) => s.route)
  sessions: PracticeSession[];

  @OneToMany(() => RouteStat, (s) => s.route)
  stats: RouteStat[];
}
