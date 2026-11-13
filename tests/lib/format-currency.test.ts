import { describe, it, expect } from "vitest";
import { formatGhs } from "../../src/lib/format-currency";

describe("formatGhs", () => {
  it("formats values in Ghanaian cedi currency", () => {
    expect(formatGhs(10)).toContain("GH₵");
    expect(formatGhs(10)).toContain("10");
  });

  it("keeps decimal precision for non-integer amounts", () => {
    expect(formatGhs(12.5)).toContain("12.5");
  });
});
