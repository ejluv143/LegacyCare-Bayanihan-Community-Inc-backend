export type FrontendMemberStatus =
  'pending' | 'active' | 'suspended' | 'inactive';

export type FrontendMembershipType = 'basic' | 'premium';

export type TopPerformersPeriod = 'month' | 'year' | 'all-time';

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

export type GenealogyPlacement = 'LEFT' | 'RIGHT';

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
  verified: boolean;

  referralCode: string;

  sponsorId: string | null;

  createdAt: string;
  joinedAt: string;
  directReferrals: number;
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

  verifiedMembers: number;
  leftMembers: number;
  rightMembers: number;
}

export interface GenealogyPlacementRulesDto {
  leftLimit: number;

  leftCount: number;
  rightCount: number;

  remainingLeftSlots: number;

  nextPlacement: GenealogyPlacement;

  leftDirectCount: number;
  rightUnlocked: boolean;
  canAddMember: boolean;
}

export interface GenealogyResponseDto {
  success: true;

  root: GenealogyMemberDto;

  branches: GenealogyBranchesDto;

  statistics: GenealogyStatisticsDto;

  placementRules: GenealogyPlacementRulesDto;

  sponsorReferralCode: string;
}
