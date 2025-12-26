import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.auditLogs, { nullable: true })
  user: User | null;

  @Column({ nullable: true })
  userId: string | null;

  @Column()
  action: string;

  @Column({
    type: process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb',
    nullable: true,
  } as any)
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;
}
