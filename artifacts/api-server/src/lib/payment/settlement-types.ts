export type SettlementProvider = "autogopay" | "ketantechpay";

export type SettlementOutcome =
  | "settled"
  | "processing"
  | "already_settled"
  | "amount_mismatch"
  | "not_found"
  | "identity_conflict"
  | "invalid_state";

export interface SettlementResult {
  outcome: SettlementOutcome;
  ownerType?: "topup" | "order";
  ownerId?: number;
  attemptId?: number;
  expectedAmount?: number;
}

export interface SettleProviderPaymentInput {
  provider: SettlementProvider;
  providerTransactionId?: string;
  transactionFingerprint?: string;
  transactionAmount?: number | null;
  /** A reconciliation match can bind an attempt which had no provider transaction id. */
  attemptId?: number;
  source: string;
  /** Webhooks must provide and match the amount. Exact-id polling may omit it. */
  requireAmount?: boolean;
  /** Only reconciliation workers should retry an already-processing order. */
  retryProcessingOrder?: boolean;
}

export interface TopupPostCommit {
  topupId: number;
  userId: number;
  creditedAmount: number;
  newBalance: number;
  username: string;
}

export interface OrderPostCommit {
  orderId: number;
  userId: number;
  amount: number;
}

export const ORDER_RETRY_LEASE_MS = 2 * 60_000;

export const normalizeIdentifier = (
  value: string | undefined,
): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};
