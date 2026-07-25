import {
  IsNotEmpty,
  IsString,
  Length,
} from "class-validator";

export class VerifyBeneficiaryUnlockCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 32)
  code!: string;
}