import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashbackService } from './cashback.service';
import { CashbackController } from './cashback.controller';
import { CashbackClaim } from '../../entities/cashback-claim.entity';
import { Track } from '../../entities/track.entity';
import { Route } from '../../entities/route.entity';
import { TestCentre } from '../../entities/test-centre.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashbackClaim, Track, Route, TestCentre])],
  providers: [CashbackService],
  controllers: [CashbackController],
})
export class CashbackModule {}
