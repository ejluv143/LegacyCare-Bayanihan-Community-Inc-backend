import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class GenerateBeneficiaryCodesDto {
  @Type(() => Number)
  @IsInt({
    message: 'quantity must be a whole number',
  })
  @Min(1, {
    message: 'quantity must be at least 1',
  })
  @Max(500, {
    message: 'quantity cannot exceed 500',
  })
  quantity!: number;
}