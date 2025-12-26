import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { CashbackClaim } from '../../entities/cashback-claim.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashbackClaim, User])],
  providers: [NotificationsService],
})
export class NotificationsModule {}
