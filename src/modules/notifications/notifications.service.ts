import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashbackClaim } from '../../entities/cashback-claim.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private running = false;

  constructor(
    @InjectRepository(CashbackClaim) private cashbackRepo: Repository<CashbackClaim>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  onModuleInit() {
    setInterval(() => this.tick().catch(() => undefined), 60_000);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 40 * 60 * 1000);

      const claims = await this.cashbackRepo
        .createQueryBuilder('c')
        .leftJoin(User, 'u', 'u.id = c.userId')
        .where('c.testScheduledAt IS NOT NULL')
        .andWhere('c.reminderSentAt IS NULL')
        .andWhere('c.testScheduledAt BETWEEN :start AND :end', {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
        })
        .andWhere("u.notificationsChoice = 'enable'")
        .andWhere('u.expoPushToken IS NOT NULL')
        .select(['c.id', 'c.userId', 'u.expoPushToken'])
        .getRawMany();

      for (const row of claims) {
        const token = row.u_expoPushToken as string | null;
        if (!token) continue;
        const ok = await this.sendPush(token);
        if (ok) {
          await this.cashbackRepo.update(row.c_id, { reminderSentAt: new Date() });
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async sendPush(to: string): Promise<boolean> {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          title: 'Drivest reminder',
          body: 'Your test is coming up. Start recording your drive to earn cashback.',
          sound: 'default',
          priority: 'high',
        }),
      });
      const json = await res.json();
      if (json?.data?.status === 'ok') return true;
      this.logger.warn(`Push send failed: ${JSON.stringify(json)}`);
      return false;
    } catch (e) {
      this.logger.warn(`Push error: ${String(e)}`);
      return false;
    }
  }
}
