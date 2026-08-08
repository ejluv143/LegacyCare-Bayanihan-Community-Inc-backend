/* =========================================================
   FRONTEND-FACING VALUES (lowercase, hyphenated)
========================================================= */

export type SatelliteTransactionTypeValue =
  | 'code-purchase'
  | 'activation-code'
  | 'top-up-code'
  | 'beneficiary-code'
  | 'claim-payout'
  | 'refund'
  | 'admin-adjustment';

export type SatelliteTransactionDirectionValue = 'credit' | 'debit';

export type SatelliteTransactionStatusValue =
  'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

export type SatelliteTransactionPaymentMethodValue =
  'gcash' | 'maya' | 'bank-transfer' | 'cash' | 'wallet' | 'system';

/* =========================================================
   TRANSACTION RESPONSE
========================================================= */

export interface SatelliteTransactionRecord {
  id: string;
  transactionNumber: string;

  satelliteId: string;
  satelliteCode: string;
  satelliteName: string;

  type: SatelliteTransactionTypeValue;
  direction: SatelliteTransactionDirectionValue;
  status: SatelliteTransactionStatusValue;

  amount: number;
  fee: number;
  netAmount: number;

  paymentMethod: SatelliteTransactionPaymentMethodValue;
  referenceNumber: string | null;

  description: string;

  relatedRequestId: string | null;
  relatedRequestNumber: string | null;

  relatedMemberId: string | null;
  relatedMembershipId: string | null;
  relatedMemberName: string | null;

  adminRemarks: string | null;

  processedBy: string | null;
  processedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface SatelliteTransactionsResponse {
  success: true;
  message: string;
  transactions: SatelliteTransactionRecord[];
}

export interface SatelliteTransactionResponse {
  success: true;
  message: string;
  transaction: SatelliteTransactionRecord;
}
