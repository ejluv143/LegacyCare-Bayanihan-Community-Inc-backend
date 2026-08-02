/* =========================================================
   MEMBER TOTALS
========================================================= */

export interface AdminMemberTotals {
  totalMembers: number;

  basicMembers: number;

  premiumMembers: number;
}

/* =========================================================
   MEMBER TOTALS RESPONSE
========================================================= */

export interface AdminMemberTotalsResponse {
  success: boolean;

  message: string;

  data: AdminMemberTotals;
}

/* =========================================================
   DASHBOARD OVERVIEW
========================================================= */

export interface AdminDashboardOverview {
  totalMembers: number;

  activeMembers: number;

  pendingMembers: number;

  suspendedMembers: number;

  totalSatellites: number;

  activeSatellites: number;

  pendingSatellites: number;

  totalTransactions: number;

  totalClaims: number;

  pendingClaims: number;
}

/* =========================================================
   DASHBOARD OVERVIEW RESPONSE
========================================================= */

export interface AdminDashboardOverviewResponse {
  success: boolean;

  message: string;

  data: AdminDashboardOverview;
}

/* =========================================================
   RECENT MEMBER
========================================================= */

export interface AdminDashboardRecentMember {
  id: string;

  membershipId: string;

  firstName: string;

  middleName: string | null;

  lastName: string;

  username: string;

  email: string | null;

  phone: string;

  membershipType: string;

  status: string;

  memberSince: Date;

  createdAt: Date;
}

/* =========================================================
   RECENT MEMBERS RESPONSE
========================================================= */

export interface AdminDashboardRecentMembersResponse {
  success: boolean;

  message: string;

  data: AdminDashboardRecentMember[];
}

/* =========================================================
   MEMBER GROWTH
========================================================= */

export interface AdminDashboardMemberGrowth {
  month: string;

  basicMembers: number;

  premiumMembers: number;

  totalMembers: number;
}

/* =========================================================
   MEMBER GROWTH RESPONSE
========================================================= */

export interface AdminDashboardMemberGrowthResponse {
  success: boolean;

  message: string;

  data: AdminDashboardMemberGrowth[];
}