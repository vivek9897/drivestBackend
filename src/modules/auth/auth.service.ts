import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuditLog } from '../../entities/audit-log.entity';
import { Entitlement, EntitlementScope } from '../../entities/entitlement.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(Entitlement) private entitlementRepo: Repository<Entitlement>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.deviceId) {
      throw new BadRequestException('Device ID required');
    }
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      email: dto.email,
      name: dto.name,
      phone: dto.phone ?? null,
      passwordHash,
      role: 'USER',
      activeDeviceId: dto.deviceId,
      activeDeviceAt: new Date(),
    });
    await this.usersRepo.save(user);
    await this.ensureWhitelistedEntitlement(user);
    await this.auditRepo.save({
      userId: user.id,
      action: 'USER_REGISTER',
      metadata: { email: user.email },
    });
    return this.buildToken(user);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersRepo.findOne({
      where: { email },
      select: ['id', 'email', 'name', 'passwordHash', 'role', 'activeDeviceId'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(dto: LoginDto) {
    if (!dto.deviceId) {
      throw new BadRequestException('Device ID required');
    }
    const user = await this.validateUser(dto.email, dto.password);
    if (user.activeDeviceId && user.activeDeviceId !== dto.deviceId) {
      throw new UnauthorizedException('Account is linked to another device');
    }
    if (!user.activeDeviceId) {
      user.activeDeviceId = dto.deviceId;
      user.activeDeviceAt = new Date();
      await this.usersRepo.save(user);
    }
    await this.ensureWhitelistedEntitlement(user);
    return this.buildToken(user);
  }

  private buildToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role || 'USER' };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  private async ensureWhitelistedEntitlement(user: User) {
    const whitelistEnv = process.env.WHITELIST_EMAILS || '';
    const whitelist = whitelistEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!user.email || !whitelist.includes(user.email.toLowerCase())) return;

    const existing = await this.entitlementRepo.findOne({
      where: { userId: user.id, scope: EntitlementScope.GLOBAL, isActive: true },
    });
    if (existing) return;

    const ent = this.entitlementRepo.create({
      userId: user.id,
      scope: EntitlementScope.GLOBAL,
      centreId: null,
      startsAt: new Date(),
      endsAt: null,
      isActive: true,
      sourcePurchaseId: null,
    });
    await this.entitlementRepo.save(ent);
  }
}
