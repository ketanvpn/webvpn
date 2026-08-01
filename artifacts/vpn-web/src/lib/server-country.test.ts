import { describe, it, expect } from "vitest";
import { parseServerLocation } from "./server-country";

describe("parseServerLocation", () => {
  it("returns Singapore for SG code", () => {
    const result = parseServerLocation("SG");
    expect(result).toEqual({ countryCode: "SG", countryName: "Singapore" });
  });

  it("returns Singapore for Singapore full name", () => {
    const result = parseServerLocation("Singapore");
    expect(result).toEqual({ countryCode: "SG", countryName: "Singapore" });
  });

  it("returns Singapore for SG-01 variant", () => {
    const result = parseServerLocation("SG-01");
    expect(result).toEqual({ countryCode: "SG", countryName: "Singapore" });
  });

  it("returns Indonesia for ID code", () => {
    const result = parseServerLocation("ID");
    expect(result).toEqual({ countryCode: "ID", countryName: "Indonesia" });
  });

  it("returns Indonesia for Indonesia full name", () => {
    const result = parseServerLocation("Indonesia");
    expect(result).toEqual({ countryCode: "ID", countryName: "Indonesia" });
  });

  it("returns Indonesia for Jakarta city name", () => {
    const result = parseServerLocation("Jakarta");
    expect(result).toEqual({ countryCode: "ID", countryName: "Indonesia" });
  });

  it("returns United States for US code", () => {
    const result = parseServerLocation("US");
    expect(result).toEqual({ countryCode: "US", countryName: "United States" });
  });

  it("returns United States for United States full name", () => {
    const result = parseServerLocation("United States");
    expect(result).toEqual({ countryCode: "US", countryName: "United States" });
  });

  it("returns null for null input", () => {
    const result = parseServerLocation(null);
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    const result = parseServerLocation("");
    expect(result).toBeNull();
  });

  it("returns null for Premium Network", () => {
    const result = parseServerLocation("Premium Network");
    expect(result).toBeNull();
  });

  it("returns null for unknown location", () => {
    const result = parseServerLocation("Unknown Location");
    expect(result).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(parseServerLocation("singapore")).toEqual({ countryCode: "SG", countryName: "Singapore" });
    expect(parseServerLocation("SINGAPORE")).toEqual({ countryCode: "SG", countryName: "Singapore" });
    expect(parseServerLocation("indonesia")).toEqual({ countryCode: "ID", countryName: "Indonesia" });
    expect(parseServerLocation("JAKARTA")).toEqual({ countryCode: "ID", countryName: "Indonesia" });
  });
});
