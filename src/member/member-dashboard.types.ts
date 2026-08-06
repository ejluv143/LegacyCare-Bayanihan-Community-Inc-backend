export type FrontendMemberStatus =
  | "pending"
  | "active"
  | "suspended"
  | "inactive";

export type FrontendMembershipType =
  | "basic"
  | "premium";

export type TopPerformersPeriod =
  | "month"
  | "year"
  | "all-time";

export interface TopPerformerDto {
  id: string;
  membershipId: string;
  fullName: string;
  profilePhoto: string | null;
  membershipType: FrontendMembershipType;
  status: FrontendMemberStatus;
  rank: number;
  totalEarnings: number;
  period: TopPerformersPeriod;
}

export interface TopPerformersResponseDto {
  success: true;
  period: TopPerformersPeriod;
  performers: TopPerformerDto[];
  totalMembers: number;
  generatedAt: string;
}

export type GenealogyPlacement =
  | "LEFT"
  | "RIGHT";

export interface GenealogyMemberDto {
  id: string;

  membershipId: string;

  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;

  username: string;

  membershipType: FrontendMembershipType;
  status: FrontendMemberStatus;

  referralCode: string;

  sponsorId: string | null;

  createdAt: string;
}

export interface GenealogyBranchesDto {
  left: GenealogyMemberDto[];
  right: GenealogyMemberDto[];
}

export interface GenealogyStatisticsDto {
  totalMembers: number;

  activeMembers: number;
  pendingMembers: number;
  suspendedMembers: number;
  inactiveMembers: number;
}

export interface GenealogyPlacementRulesDto {
  leftLimit: number;

  leftCount: number;
  rightCount: number;

  remainingLeftSlots: number;

  nextPlacement: GenealogyPlacement;
}

export interface GenealogyResponseDto {
  success: true;

  root: GenealogyMemberDto;

  branches: GenealogyBranchesDto;

  statistics: GenealogyStatisticsDto;

  placementRules: GenealogyPlacementRulesDto;

  sponsorReferralCode: string;
}
