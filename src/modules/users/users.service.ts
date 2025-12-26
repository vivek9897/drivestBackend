import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateConsentsDto } from './dto/update-consents.dto';
import { AuditLog } from '../../entities/audit-log.entity';
import { v4 as uuid } from 'uuid';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    await this.usersRepo.update(userId, dto);
    await this.auditRepo.save({ userId, action: 'USER_UPDATE', metadata: dto });
    return this.findById(userId);
  }

  async updateConsents(userId: string, dto: UpdateConsentsDto) {
    await this.usersRepo.update(userId, {
      baseAcceptedAt: dto.baseAcceptedAt ? new Date(dto.baseAcceptedAt) : undefined,
      ageConfirmedAt: dto.ageConfirmedAt ? new Date(dto.ageConfirmedAt) : undefined,
      analyticsChoice: dto.analyticsChoice,
      analyticsAt: dto.analyticsAt ? new Date(dto.analyticsAt) : undefined,
      notificationsChoice: dto.notificationsChoice,
      notificationsAt: dto.notificationsAt ? new Date(dto.notificationsAt) : undefined,
      locationChoice: dto.locationChoice,
      locationAt: dto.locationAt ? new Date(dto.locationAt) : undefined,
      safetyAcceptedAt: dto.safetyAcceptedAt ? new Date(dto.safetyAcceptedAt) : undefined,
    });
    await this.auditRepo.save({ userId, action: 'USER_CONSENT_UPDATE', metadata: dto });
    return this.findById(userId);
  }

  async updatePushToken(userId: string, expoPushToken: string | null) {
    await this.usersRepo.update(userId, { expoPushToken });
    await this.auditRepo.save({
      userId,
      action: 'USER_PUSH_TOKEN_UPDATE',
      metadata: { hasToken: Boolean(expoPushToken) },
    });
    return this.findById(userId);
  }

  async softDelete(userId: string) {
    const user = await this.findById(userId);
    const anonymized = {
      email: null,
      phone: null,
      name: `deleted-${uuid()}`,
    };
    await this.usersRepo.update(userId, anonymized);
    await this.usersRepo.softDelete(userId);
    await this.auditRepo.save({ userId, action: 'USER_DELETE', metadata: {} });
    return { success: true };
  }
}
