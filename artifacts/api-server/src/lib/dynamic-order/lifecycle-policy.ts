export const DYNAMIC_ORDER_STATUSES = [
  "pending",
  "processing",
  "paid",
  "failed",
  "expired",
] as const;

export type DynamicOrderStatus = (typeof DYNAMIC_ORDER_STATUSES)[number];

export const parseDynamicOrderStatus = (
  status: string,
): DynamicOrderStatus | null =>
  DYNAMIC_ORDER_STATUSES.find((candidate) => candidate === status) ?? null;

export const RETRYABLE_DYNAMIC_ORDER_STATUSES = ["pending", "failed"] as const;
export type RetryableDynamicOrderStatus =
  (typeof RETRYABLE_DYNAMIC_ORDER_STATUSES)[number];

export const ACTIVE_DYNAMIC_ORDER_STATUSES = ["pending", "processing"] as const;
export type ActiveDynamicOrderStatus =
  (typeof ACTIVE_DYNAMIC_ORDER_STATUSES)[number];

export type DynamicOrderConfiguration = {
  readonly dynamicServerId: number;
  readonly protocol: string;
  readonly durationType: string;
  readonly duration: number;
  readonly username: string;
  readonly password: string | null;
  readonly paymentMethod: string;
  readonly voucherId: number | null;
};

type PersistedDynamicOrderConfiguration = Omit<DynamicOrderConfiguration, "dynamicServerId"> & {
  readonly dynamicServerId: number | null;
};

export const toDynamicOrderConfiguration = (
  order: PersistedDynamicOrderConfiguration,
): DynamicOrderConfiguration | null => {
  if (order.dynamicServerId === null) return null;

  return {
    dynamicServerId: order.dynamicServerId,
    protocol: order.protocol,
    durationType: order.durationType,
    duration: order.duration,
    username: order.username,
    password: order.password,
    paymentMethod: order.paymentMethod,
    voucherId: order.voucherId,
  };
};

export type CreationDecision =
  | { readonly kind: "create" }
  | { readonly kind: "reuse" }
  | { readonly kind: "conflict"; readonly status: "processing" };

export type PaymentLockDecision =
  | { readonly kind: "lock" }
  | {
      readonly kind: "reject";
      readonly status: Exclude<DynamicOrderStatus, RetryableDynamicOrderStatus>;
    };

export type ProcessingGuidance =
  | { readonly kind: "retryable"; readonly nextStatus: "failed" }
  | { readonly kind: "terminal"; readonly nextStatus: "expired" };

type ExistingOrder = {
  readonly status: DynamicOrderStatus;
  readonly configuration: DynamicOrderConfiguration;
};

const assertNever = (value: never): never => value;

const configurationsAreEquivalent = (
  left: DynamicOrderConfiguration,
  right: DynamicOrderConfiguration,
): boolean =>
  left.dynamicServerId === right.dynamicServerId &&
  left.protocol === right.protocol &&
  left.durationType === right.durationType &&
  left.duration === right.duration &&
  left.username === right.username &&
  left.password === right.password &&
  left.paymentMethod === right.paymentMethod &&
  left.voucherId === right.voucherId;

export const decideCreation = (
  existingOrder: ExistingOrder | null,
  requestedConfiguration: DynamicOrderConfiguration,
): CreationDecision => {
  if (
    existingOrder === null ||
    !configurationsAreEquivalent(
      existingOrder.configuration,
      requestedConfiguration,
    )
  ) {
    return { kind: "create" };
  }

  switch (existingOrder.status) {
    case "pending":
    case "failed":
      return { kind: "reuse" };
    case "processing":
      return { kind: "conflict", status: "processing" };
    case "paid":
    case "expired":
      return { kind: "create" };
    default:
      return assertNever(existingOrder.status);
  }
};

export const decidePaymentLock = (
  status: DynamicOrderStatus,
): PaymentLockDecision => {
  switch (status) {
    case "pending":
    case "failed":
      return { kind: "lock" };
    case "processing":
    case "paid":
    case "expired":
      return { kind: "reject", status };
    default:
      return assertNever(status);
  }
};

export const processingGuidance = (
  failureIsRetryable: boolean,
): ProcessingGuidance =>
  failureIsRetryable
    ? { kind: "retryable", nextStatus: "failed" }
    : { kind: "terminal", nextStatus: "expired" };
