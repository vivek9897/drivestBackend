import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CentresModule } from './modules/centres/centres.module';
import { RoutesModule } from './modules/routes/routes.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { CashbackModule } from './modules/cashback/cashback.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CentresModule,
    RoutesModule,
    EntitlementsModule,
    CashbackModule,
    WebhooksModule,
    HealthModule,
    AdminModule,
    NotificationsModule,
  ],
})
export class AppModule {}
