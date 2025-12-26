import { IsJSON, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TrackSummary {
  @IsOptional()
  durationS?: number;

  @IsOptional()
  distanceM?: number;

  @IsOptional()
  avgSpeedKph?: number;

  @IsOptional()
  points?: Array<{ lat: number; lng: number; t?: number }>;
}

export class SubmitCashbackDto {
  @ValidateNested()
  @Type(() => TrackSummary)
  trackSummary: TrackSummary;

  @IsOptional()
  @IsString()
  centreId?: string;

  @IsOptional()
  @IsString()
  routeId?: string;

  @IsOptional()
  @IsString()
  pointsS3Key?: string;

  @IsOptional()
  @IsString()
  gpx?: string;

  @IsOptional()
  @IsString()
  testDateTime?: string;
}
