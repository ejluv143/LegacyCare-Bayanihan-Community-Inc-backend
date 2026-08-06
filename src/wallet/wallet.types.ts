export type WalletMembershipType = 'basic' | 'premium';

export type WalletApiTransactionType =
  | 'opening-credit'
  | 'top-up'
  | 'pairing-income'
  | 'referral-commission'
  | 'group-commission'
  | 'withdrawal'
  | 'adjustment';

export type WalletApiTransactionStatus =
  'completed' | 'pending' | 'failed' | 'reversed';

export type WalletApiTransactionDirection = 'credit' | 'debit' | 'neutral';

export interface WalletMemberDto {
  id: string;
  membershipId: string;
  fullName: string;
  membershipType: WalletMembershipType;
  beneficiaries: string[];
}

export interface WalletSummaryDto {
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  totalWithdrawn: number;
  referralCommission: number;
  groupCommission: number;
}

export interface WalletTransactionDto {
  id: string;
  type: WalletApiTransactionType;
  status: WalletApiTransactionStatus;
  direction: WalletApiTransactionDirection;
  title: string;
  description: string;
  amount: number;
  createdAt: string;
  membershipType?: WalletMembershipType;
}

export interface WalletResponseDto {
  success: true;
  member: WalletMemberDto;
  summary: WalletSummaryDto;
  pairingWindows: [];
  transactions: WalletTransactionDto[];
  generatedAt: string;
}

export interface RedeemTopUpResponseDto {
  success: true;
  message: string;
  creditedAmount: number;
  wallet: WalletResponseDto;
}
