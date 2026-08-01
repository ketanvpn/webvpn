import { describe, expect, it } from "vitest";
import {
  decideCreation,
  decidePaymentLock,
  parseDynamicOrderStatus,
  toDynamicOrderConfiguration,
  processingGuidance,
  type DynamicOrderConfiguration,
} from "./lifecycle-policy";

const configuration = {
  dynamicServerId: 12,
  protocol: "ssh",
  durationType: "days",
  duration: 30,
  username: "alice12",
  password: "secret12",
  paymentMethod: "balance",
  voucherId: null,
} satisfies DynamicOrderConfiguration;

describe("dynamic order lifecycle policy", () => {
  it("parses known persisted order statuses", () => {
    // Given
    const persistedStatus = "failed";

    // When
    const status = parseDynamicOrderStatus(persistedStatus);

    // Then
    expect(status).toBe("failed");
  });

  it("rejects an unknown persisted order status", () => {
    // Given
    const persistedStatus = "provider_unknown";

    // When
    const status = parseDynamicOrderStatus(persistedStatus);

    // Then
    expect(status).toBeNull();
  });

  it("does not treat a legacy order without a dynamic server as equivalent", () => {
    // Given
    const legacyOrder = { ...configuration, dynamicServerId: null };

    // When
    const parsedConfiguration = toDynamicOrderConfiguration(legacyOrder);

    // Then
    expect(parsedConfiguration).toBeNull();
  });

  it.each(["pending", "failed"] as const)(
    "reuses an equivalent %s order during creation",
    (status) => {
      // Given
      const existingOrder = { status, configuration };

      // When
      const decision = decideCreation(existingOrder, configuration);

      // Then
      expect(decision).toEqual({ kind: "reuse" });
    },
  );

  it("blocks an equivalent processing order during creation", () => {
    // Given
    const existingOrder = { status: "processing", configuration } as const;

    // When
    const decision = decideCreation(existingOrder, configuration);

    // Then
    expect(decision).toEqual({ kind: "conflict", status: "processing" });
  });

  it("allows creation for a distinct configuration", () => {
    // Given
    const existingOrder = { status: "pending", configuration } as const;
    const distinctConfiguration = { ...configuration, duration: 60 };

    // When
    const decision = decideCreation(existingOrder, distinctConfiguration);

    // Then
    expect(decision).toEqual({ kind: "create" });
  });

  it.each(["pending", "failed"] as const)(
    "allows payment lock for %s orders",
    (status) => {
      // Given
      const orderStatus = status;

      // When
      const decision = decidePaymentLock(orderStatus);

      // Then
      expect(decision).toEqual({ kind: "lock" });
    },
  );

  it.each(["paid", "expired", "processing"] as const)(
    "rejects payment lock for %s orders",
    (status) => {
      // Given
      const orderStatus = status;

      // When
      const decision = decidePaymentLock(orderStatus);

      // Then
      expect(decision).toEqual({ kind: "reject", status });
    },
  );

  it("guides retryable failures back to failed", () => {
    // Given
    const failureIsRetryable = true;

    // When
    const guidance = processingGuidance(failureIsRetryable);

    // Then
    expect(guidance).toEqual({ kind: "retryable", nextStatus: "failed" });
  });

  it("guides non-retryable failures to expired", () => {
    // Given
    const failureIsRetryable = false;

    // When
    const guidance = processingGuidance(failureIsRetryable);

    // Then
    expect(guidance).toEqual({ kind: "terminal", nextStatus: "expired" });
  });

});
