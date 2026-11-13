import { describe, it, expect } from "vitest";
import { normalizeGhanaPhone, whatsappDigits } from "../../src/lib/phone";

describe("normalizeGhanaPhone", () => {
  it("normalizes a valid local Ghanaian mobile number", () => {
    expect(normalizeGhanaPhone("0241234567")).toBe("+233241234567");
  });

  it("accepts a valid international number", () => {
    expect(normalizeGhanaPhone("233241234567")).toBe("+233241234567");
  });

  it("rejects numbers that are not valid Ghanaian mobile numbers", () => {
    expect(() => normalizeGhanaPhone("12345")).toThrow(
      "This is not a valid Ghanaian phone number.",
    );
    expect(() => normalizeGhanaPhone("5551234567")).toThrow(
      "This is not a valid Ghanaian phone number.",
    );
  });
});

describe("whatsappDigits", () => {
  it("removes formatting from a phone number while preserving digits", () => {
    expect(whatsappDigits("+233 (24) 123-4567")).toBe("233241234567");
  });
});
