import { describe, it, expect } from "vitest";
import {
  colourNameFromFile,
  matchProductFolder,
} from "../../src/lib/catalog-folder";

describe("matchProductFolder", () => {
  it("returns the exact slug when it exists as a folder name", () => {
    expect(matchProductFolder("cargo-pants", ["cargo-pants", "office"])).toBe(
      "cargo-pants",
    );
  });

  it("uses a configured alias for a known product naming difference", () => {
    expect(matchProductFolder("beltless-material-trousers", ["beltless-trouser"]))
      .toBe("beltless-trouser");
  });

  it("returns null when the folder match is ambiguous", () => {
    expect(matchProductFolder("cargo-pants", ["cargo", "pants"])).toBeNull();
  });
});

describe("colourNameFromFile", () => {
  it("converts file names into readable colour names", () => {
    expect(colourNameFromFile("light-brown.jpeg")).toBe("Light Brown");
    expect(colourNameFromFile("dark_blue.webp")).toBe("Dark Blue");
  });
});
