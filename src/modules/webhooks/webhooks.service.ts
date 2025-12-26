import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevenueCatEventDto } from './dto/revenuecat-event.dto';
import {
  Purchase,
  PurchaseProvider,
  PurchaseStatus,
} from '../../entities/purchase.entity';
import { Product, ProductType } from '../../entities/product.entity';
import { Entitlement, EntitlementScope } from '../../entities/entitlement.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { createHmac } from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Purchase) private purchaseRepo: Repository<Purchase>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Entitlement) private entRepo: Repository<Entitlement>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  verifySignature(body: string, signature: string, secret: string) {
    const hash = createHmac('sha256', secret).update(body).digest('hex');
    if (hash !== signature) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  async handleRevenueCat(event: RevenueCatEventDto) {
    const product = await this.productRepo.findOne({
      where: [{ iosProductId: event.productId }, { androidProductId: event.productId }],
    });
    if (!product) return { ignored: true };

    const existing = await this.purchaseRepo.findOne({
      where: { transactionId: event.transactionId },
    });
    if (existing) {
      return existing;
    }

    const purchase = this.purchaseRepo.create({
      userId: event.userId,
      productId: product.id,
      provider: PurchaseProvider.REVCAT,
      transactionId: event.transactionId,
      status: PurchaseStatus.COMPLETED,
      purchasedAt: new Date(event.purchasedAt),
      rawEvent: event.raw,
    });
    await this.purchaseRepo.save(purchase);

    const isSubscription = product.type === ProductType.SUBSCRIPTION;
    const centreId = product.metadata?.centreId ?? null;
    const centreScoped =
      product.metadata?.scope === EntitlementScope.CENTRE ||
      (!isSubscription && centreId);
    const endsAt = event.expiresAt ? new Date(event.expiresAt) : null;
    const entitlement = this.entRepo.create({
      userId: event.userId,
      scope: centreScoped ? EntitlementScope.CENTRE : EntitlementScope.GLOBAL,
      centreId: centreScoped ? centreId : null,
      startsAt: new Date(event.purchasedAt),
      endsAt,
      isActive: !endsAt || endsAt > new Date(),
      sourcePurchaseId: purchase.id,
    });
    await this.entRepo.save(entitlement);

    await this.auditRepo.save({
      userId: event.userId,
      action: 'REVENUECAT_EVENT',
      metadata: { transactionId: event.transactionId, productId: product.id },
    });
    return { success: true };
  }
}
