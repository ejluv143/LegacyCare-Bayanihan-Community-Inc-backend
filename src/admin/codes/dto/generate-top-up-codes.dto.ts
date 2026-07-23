import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export enum TopUpAmount {
  PHP_200 = 200,
  PHP_500 = 500,
  PHP_1500 = 1500,
}

export class GenerateTopUpCodesDto {
  @Type(() => Number)
  @IsIn([TopUpAmount.PHP_200, TopUpAmount.PHP_500, TopUpAmount.PHP_1500], {
    message: 'amount must be 200, 500, or 1500',
  })
  amount!: TopUpAmount;

  @Type(() => Number)
  @IsInt({
    message: 'quantity must be a whole number',
  })
  @Min(1, {
    message: 'quantity must be at least 1',
  })
  @Max(100, {
    message: 'quantity cannot exceed 100',
  })
  quantity!: number;
}
