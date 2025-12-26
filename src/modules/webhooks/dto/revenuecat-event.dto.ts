import { IsObject, IsString } from 'class-validator';

export class RevenueCatEventDto {
  @IsString()
  eventId: string;

  @IsString()
  productId: string;

  @IsString()
  transactionId: string;

  @IsString()
  userId: string;

  @IsString()
  type: string; // PURCHASED, RENEWED, EXPIRED

  @IsObject()
  raw: any;

  @IsString()
  purchasedAt: string;

  @IsString()
  expiresAt?: string;
}
