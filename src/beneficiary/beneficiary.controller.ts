import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import { BeneficiaryService } from "./beneficiary.service";

const RELATIONSHIPS = [
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Grandparent",
  "Guardian",
  "Other",
] as const;

class CreateBeneficiaryDto {
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
  @MaxLength(1000)
  address!: string;

  @IsString()
  @IsIn(RELATIONSHIPS)
  relationship!: string;
}

interface AuthenticatedMemberRequest {
  user?: {
    membershipId?: string;
    member?: {
      membershipId?: string;
    };
  };
}

@Controller("member/dashboard/beneficiaries")
export class BeneficiaryController {
  constructor(private readonly beneficiaryService: BeneficiaryService) {}

  @Post()
  create(
    @Req() request: AuthenticatedMemberRequest,
    @Body() body: CreateBeneficiaryDto,
  ) {
    const primaryMembershipId =
      request.user?.membershipId ?? request.user?.member?.membershipId;

    if (!primaryMembershipId) {
      throw new UnauthorizedException(
        "The authenticated member ID was not found.",
      );
    }

    return this.beneficiaryService.createForMember(primaryMembershipId, body);
  }
}
