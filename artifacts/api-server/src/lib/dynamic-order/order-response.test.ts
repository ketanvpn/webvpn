import { describe, expect, it } from "vitest";
import { formatDynamicOrderForUser } from "./order-response";

describe("formatDynamicOrderForUser", () => {
  it("omits credentials and provider payload while preserving order fields", () => {
    // Given
    const order = {
      id: 7,
      amount: "25000.00",
      discountAmount: "5000.00",
      password: "secret-password",
      providerResponse: { providerToken: "private" },
    };

    // When
    const response = formatDynamicOrderForUser(order);

    // Then
    expect(response).toEqual({ id: 7, amount: 25000, discountAmount: 5000 });
  });
});
