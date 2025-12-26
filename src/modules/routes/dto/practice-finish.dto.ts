import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class PracticeFinishDto {
  @IsBoolean()
  completed: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  distanceM?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationS?: number;
}
