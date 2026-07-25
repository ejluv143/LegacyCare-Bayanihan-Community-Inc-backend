import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from "class-validator";

export class RedeemBeneficiaryCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, {
    message:
      "Beneficiary code cannot exceed 50 characters.",
  })
  code!: string;
}