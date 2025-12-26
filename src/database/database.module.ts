import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { TestCentre } from '../entities/test-centre.entity';
import { Route } from '../entities/route.entity';
import { Product } from '../entities/product.entity';
import { Purchase } from '../entities/purchase.entity';
import { Entitlement } from '../entities/entitlement.entity';
import { PracticeSession } from '../entities/practice-session.entity';
import { RouteStat } from '../entities/route-stat.entity';
import { CashbackClaim } from '../entities/cashback-claim.entity';
import { Track } from '../entities/track.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          User,
          TestCentre,
          Route,
          Product,
          Purchase,
          Entitlement,
          PracticeSession,
          RouteStat,
          CashbackClaim,
          Track,
          AuditLog,
        ],
        synchronize: false,
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
