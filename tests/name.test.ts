import { describe, expect, it } from "vitest";
import { entryAltName, entryLabel, matchesEntryName } from "../src/lib/name";

describe("entryLabel", () => {
  it("prefers the entry name over the ESPN account name", () => {
    expect(entryLabel("Neil Demblomi", "michaelotter")).toBe("Neil Demblomi");
  });

  it("falls back to the account name when the entry has no name", () => {
    expect(entryLabel("", "michaelotter")).toBe("michaelotter");
  });

  it("ignores blank and placeholder names", () => {
    expect(entryLabel("   ", "  ")).toBe("Unknown");
    expect(entryLabel("", "Unknown")).toBe("Unknown");
  });

  it("keeps the ESPN default account name when there is nothing else", () => {
    expect(entryLabel("", "Unknown")).toBe("Unknown");
  });
});

describe("entryAltName", () => {
  it("reveals the account name behind a shown entry name", () => {
    expect(entryAltName("Neil Demblomi", "michaelotter")).toBe("michaelotter");
  });

  it("has nothing extra to reveal when the entry has no name", () => {
    expect(entryAltName("", "michaelotter")).toBeUndefined();
  });

  it("has nothing to reveal when the names agree", () => {
    expect(entryAltName("Sam", "Sam")).toBeUndefined();
    expect(entryAltName("", "Unknown")).toBeUndefined();
  });
});

describe("matchesEntryName", () => {
  const entry = { entryName: "Neil Demblomi", displayName: "michaelotter" };

  it("matches either name, case-insensitively", () => {
    expect(matchesEntryName(entry, "Neil Demblomi")).toBe(true);
    expect(matchesEntryName(entry, "neil demblomi")).toBe(true);
    expect(matchesEntryName(entry, "michaelotter")).toBe(true);
  });

  it("rejects other names and blanks", () => {
    expect(matchesEntryName(entry, "someone else")).toBe(false);
    expect(matchesEntryName(entry, "  ")).toBe(false);
  });
});