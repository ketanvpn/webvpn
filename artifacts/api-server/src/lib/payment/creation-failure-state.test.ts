import { describe, expect, it } from "vitest";
import { paymentCreationFailureState } from "./creation-failure-state";

describe("paymentCreationFailureState", () => {
  it("keeps the public owner pending while an ambiguous attempt is reconciled", () => {
    expect(paymentCreationFailureState("unknown")).toEqual({
      orderStatus: "pending",
      topupStatus: "pending",
      topupRejectionNote: null,
      attemptCompleted: false,
    });
  });

  it("marks the owner and attempt terminal after a definitive failure", () => {
    expect(paymentCreationFailureState("failed")).toEqual({
      orderStatus: "failed",
      topupStatus: "rejected",
      topupRejectionNote: "Pembuatan QRIS gagal",
      attemptCompleted: true,
    });
  });
});
