/* =========================================================
   CLIENT ACCOUNT
========================================================= */

export type SatelliteGenealogyClientStatus =
  'active' | 'pending' | 'suspended' | 'inactive';

export type SatelliteGenealogyMembershipType = 'basic' | 'premium';

/* =========================================================
   NETWORK PLACEMENT
========================================================= */

export type SatelliteNetworkPlacement = 'root' | 'left' | 'right';

/* =========================================================
   GENEALOGY CLIENT
========================================================= */

export interface SatelliteGenealogyClient {
  id: string;

  membershipId: string;

  fullName: string;

  username: string;

  membershipType: SatelliteGenealogyMembershipType;

  status: SatelliteGenealogyClientStatus;

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

export interface SatelliteNetworkTreeNode {
  id: string;

  memberId: string;

  membershipId: string;

  fullName: string;

  username: string;

  membershipType: SatelliteGenealogyMembershipType;

  status: SatelliteGenealogyClientStatus;

  placement: SatelliteNetworkPlacement;

  verified: boolean;

  directReferralCount: number;

  rightBranchUnlocked: boolean;

  parentId: string | null;

  children: SatelliteNetworkTreeNode[];
}

/* =========================================================
   CLIENT DIRECTORY RESPONSE
========================================================= */

export interface SatelliteGenealogyClientsResponse {
  success: boolean;

  message: string;

  data: {
    clients: SatelliteGenealogyClient[];
  };
}

/* =========================================================
   NETWORK TREE RESPONSE
========================================================= */

export interface SatelliteGenealogyTreeResponse {
  success: boolean;

  message: string;

  data: {
    client: SatelliteGenealogyClient;

    root: SatelliteNetworkTreeNode | null;
  };
}
