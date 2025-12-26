import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Purchase } from './purchase.entity';
import { Entitlement } from './entitlement.entity';
import { PracticeSession } from './practice-session.entity';
import { RouteStat } from './route-stat.entity';
import { CashbackClaim } from './cashback-claim.entity';
import { Track } from './track.entity';
import { AuditLog } from './audit-log.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column()
  name: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ default: 'USER' })
  role: 'USER' | 'ADMIN';

  @Column({ type: 'timestamptz', nullable: true })
  baseAcceptedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  ageConfirmedAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  analyticsChoice?: 'allow' | 'skip' | null;

  @Column({ type: 'timestamptz', nullable: true })
  analyticsAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  notificationsChoice?: 'enable' | 'skip' | null;

  @Column({ type: 'timestamptz', nullable: true })
  notificationsAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  expoPushToken?: string | null;

  @Column({ type: 'varchar', nullable: true })
  locationChoice?: 'allow' | 'deny' | 'skip' | null;

  @Column({ type: 'timestamptz', nullable: true })
  locationAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  safetyAcceptedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date | null;

  @OneToMany(() => Purchase, (p) => p.user)
  purchases: Purchase[];

  @OneToMany(() => Entitlement, (e) => e.user)
  entitlements: Entitlement[];

  @OneToMany(() => PracticeSession, (s) => s.user)
  sessions: PracticeSession[];

  @OneToMany(() => RouteStat, (s) => s.user)
  stats: RouteStat[];

  @OneToMany(() => CashbackClaim, (c) => c.user)
  cashbackClaims: CashbackClaim[];

  @OneToMany(() => Track, (t) => t.user)
  tracks: Track[];

  @OneToMany(() => AuditLog, (a) => a.user)
  auditLogs: AuditLog[];
}
