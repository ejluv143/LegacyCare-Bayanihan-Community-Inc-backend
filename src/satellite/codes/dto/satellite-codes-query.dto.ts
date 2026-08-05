import { Type } from 'class-transformer';

import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SatelliteCodesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'activation', 'top-up', 'beneficiary'])
  category?: string = 'all';

  @IsOptional()
  @IsIn(['all', 'available', 'used', 'expired', 'disabled'])
  status?: string = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
