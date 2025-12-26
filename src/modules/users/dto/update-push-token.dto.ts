import { IsOptional, IsString } from 'class-validator';

export class UpdatePushTokenDto {
  @IsOptional()
  @IsString()
  expoPushToken?: string;
}
