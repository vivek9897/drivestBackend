import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { Purchase } from '../../entities/purchase.entity';
import { Product } from '../../entities/product.entity';
import { Entitlement } from '../../entities/entitlement.entity';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase, Product, Entitlement, User, AuditLog])],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
