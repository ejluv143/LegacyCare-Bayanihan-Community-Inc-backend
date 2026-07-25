import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export enum BeneficiaryRelationship {
  SPOUSE = "Spouse",
  CHILD = "Child",
  PARENT = "Parent",
  SIBLING = "Sibling",
  GRANDPARENT = "Grandparent",
  GUARDIAN = "Guardian",
  OTHER = "Other",
}

export class CreateBeneficiaryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @IsEnum(BeneficiaryRelationship)
  relationship!: BeneficiaryRelationship;
}