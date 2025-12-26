import { Body, Controller, Headers, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { RevenueCatEventDto } from './dto/revenuecat-event.dto';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private webhookService: WebhooksService,
    private configService: ConfigService,
  ) {}

  @Post('revenuecat')
  async revenuecat(
    @Body() body: any,
    @Headers('x-revenuecat-signature') signature?: string,
  ) {
    const secret = this.configService.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('Webhook secret not configured');
    }
    if (!signature) {
      throw new Error('Signature missing');
    }
    this.webhookService.verifySignature(JSON.stringify(body), signature, secret);
    const event: RevenueCatEventDto = {
      eventId: body.event_id || body.eventId,
      productId: body.product_id || body.productId,
      transactionId: body.transaction_id || body.transactionId,
      userId: body.app_user_id || body.userId,
      type: body.type,
      raw: body,
      purchasedAt: body.purchased_at || new Date().toISOString(),
      expiresAt: body.expiration_at,
    };
    return this.webhookService.handleRevenueCat(event);
  }
}
