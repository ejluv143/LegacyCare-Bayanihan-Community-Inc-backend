/* =========================================================
   CLIENT ACCOUNT
========================================================= */

export type AdminGenealogyClientStatus =
  'active' | 'pending' | 'suspended' | 'inactive';

export type AdminGenealogyMembershipType = 'basic' | 'premium';

/* =========================================================
   NETWORK PLACEMENT
========================================================= */

export type AdminNetworkPlacement = 'root' | 'left' | 'right';

/* =========================================================
   GENEALOGY CLIENT
========================================================= */

export interface AdminGenealogyClient {
  id: string;

  membershipId: string;

  fullName: string;

  username: string;

  membershipType: AdminGenealogyMembershipType;

  status: AdminGenealogyClientStatus;

  referralCode: string;

  sponsorId: string | null;

  sponsorName: string | null;

  sponsorMembershipId: string | null;

  directReferralCount: number;

  leftNetworkCount: number;

  rightNetworkCount: number;

  totalNetworkCount: number;

  rightBranchUnlocked: boolean;

  joinedAt: string;
}

/* =========================================================
   NETWORK TREE NODE
========================================================= */

export interface AdminNetworkTreeNode {
  id: string;

  memberId: string;

  membershipId: string;

  fullName: string;

  username: string;

  membershipType: AdminGenealogyMembershipType;

  status: AdminGenealogyClientStatus;

  placement: AdminNetworkPlacement;

  verified: boolean;

  directReferralCount: number;

  parentId: string | null;

  children: AdminNetworkTreeNode[];
}

/* =========================================================
   GENEALOGY SUMMARY
========================================================= */

export interface AdminGenealogySummary {
  totalClients: number;

  activeClients: number;

  pendingClients: number;

  totalNetworkMembers: number;

  totalLeftMembers: number;

  totalRightMembers: number;

  rightUnlockedClients: number;
}

/* =========================================================
   CLIENT DIRECTORY RESPONSE
========================================================= */

export interface AdminGenealogyClientsResponse {
  success: boolean;

  message: string;

  data: {
    clients: AdminGenealogyClient[];
  };
}

/* =========================================================
   NETWORK TREE RESPONSE
========================================================= */

export interface AdminGenealogyTreeResponse {
  success: boolean;

  message: string;

  data: {
    client: AdminGenealogyClient;

    root: AdminNetworkTreeNode | null;
  };
}
