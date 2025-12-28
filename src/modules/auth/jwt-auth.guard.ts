import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const can = (await super.canActivate(context)) as boolean;
    if (!can) return false;

    const req = context.switchToHttp().getRequest();
    const deviceId = req.headers['x-device-id'];
    if (!deviceId || typeof deviceId !== 'string') {
      throw new UnauthorizedException('Device ID required');
    }

    const userId = req.user?.sub as string | undefined;
    if (!userId) return true;

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) return true;
    if (user.activeDeviceId && user.activeDeviceId !== deviceId) {
      throw new UnauthorizedException('Device mismatch');
    }
    if (!user.activeDeviceId) {
      user.activeDeviceId = deviceId;
      user.activeDeviceAt = new Date();
      await this.usersRepo.save(user);
    }
    return true;
  }
}
