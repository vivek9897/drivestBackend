import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entitlement, EntitlementScope } from '../../entities/entitlement.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(Entitlement)
    private entRepo: Repository<Entitlement>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async userEntitlements(userId: string) {
    await this.ensureWhitelist(userId);
    return this.entRepo
      .createQueryBuilder('ent')
      .where('ent.userId = :userId', { userId })
      .andWhere('ent.isActive = true')
      .andWhere('(ent.endsAt IS NULL OR ent.endsAt > :now)', { now: new Date() })
      .orderBy('ent.endsAt', 'ASC')
      .getMany();
  }

  async hasAccess(userId: string, centreId: string): Promise<boolean> {
    await this.ensureWhitelist(userId);
    const qb = this.entRepo
      .createQueryBuilder('ent')
      .where('ent.userId = :userId', { userId })
      .andWhere('ent.isActive = true')
      .andWhere('(ent.endsAt IS NULL OR ent.endsAt > :now)', { now: new Date() })
      .andWhere(
        '(ent.scope = :global OR (ent.scope = :centre AND ent.centreId = :centreId))',
        { global: EntitlementScope.GLOBAL, centre: EntitlementScope.CENTRE, centreId },
      )
      .limit(1);
    const entitlement = await qb.getOne();
    return Boolean(entitlement);
  }

  private async ensureWhitelist(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.email) return;
    const whitelistEnv = process.env.WHITELIST_EMAILS || '';
    const whitelist = whitelistEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!whitelist.length || !whitelist.includes(user.email.toLowerCase())) return;

    const existing = await this.entRepo.findOne({
      where: { userId: user.id, scope: EntitlementScope.GLOBAL, isActive: true },
    });
    if (existing) return;

    await this.entRepo.save(
      this.entRepo.create({
        userId: user.id,
        scope: EntitlementScope.GLOBAL,
        centreId: null,
        startsAt: new Date(),
        endsAt: null,
        isActive: true,
        sourcePurchaseId: null,
      }),
    );
  }
}
