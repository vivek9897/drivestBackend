import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { Route } from '../../entities/route.entity';
import { PracticeSession } from '../../entities/practice-session.entity';
import { RouteStat } from '../../entities/route-stat.entity';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { TestCentre } from '../../entities/test-centre.entity';

@Module({
  imports: [
    EntitlementsModule,
    TypeOrmModule.forFeature([Route, PracticeSession, RouteStat, TestCentre]),
  ],
  providers: [RoutesService],
  controllers: [RoutesController],
})
export class RoutesModule {}
