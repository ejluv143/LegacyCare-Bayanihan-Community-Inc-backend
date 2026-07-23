import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DisableGeneratedCodeDto {
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedReason = value.trim();

    return normalizedReason || undefined;
  })
  @IsOptional()
  @IsString({
    message: 'reason must be text',
  })
  @MaxLength(500, {
    message: 'reason cannot exceed 500 characters',
  })
  reason?: string;
}