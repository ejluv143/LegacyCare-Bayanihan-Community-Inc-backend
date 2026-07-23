import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';

export enum ActivationMembershipType {
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export class GenerateActivationCodesDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEnum(ActivationMembershipType, {
    message: 'membershipType must be either basic or premium',
  })
  membershipType!: ActivationMembershipType;

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
