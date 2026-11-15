import { describe, expect, it } from "vitest";
import { buildPeople, entryLabel, initialsOf } from "../src/lib/name";

const e = (entryId: string, entryName: string, displayName: string) => ({
  entryId,
  entryName,
  displayName,
});

describe("entryLabel", () => {
  it("prefers the entry name, then the account name", () => {
    expect(entryLabel("Fin Fader", "maxb")).toBe("Fin Fader");
    expect(entryLabel("  ", "maxb")).toBe("maxb");
    expect(entryLabel("", "Unknown")).toBe("Unknown");
  });
});

describe("buildPeople", () => {
  const people = buildPeople([
    e("1", "Sam's 1st Entry", "sammandelbaum"),
    e("2", "Sam's 1st Entry", "Sam Leibner"),
    e("3", "Sam's 1st Entry", "sam.crown"),
    e("4", "Sam's 1st Entry", "Truu Skillz"),
    e("5", "Moody", "espn41554331"),
    e("6", "Chris' 1st Entry", "ChrisH1249"),
    e("7", "Jake 's 1st Entry", "JakeTheGuitarist01"),
    e("8", "", "lonely"),
    e("9", "nancy's 1st Entry", "Kylespott"),
  ]);

  it("tells same-named default entries apart with an initial", () => {
    expect(people.get("1")?.name).toBe("Sam M.");
    expect(people.get("2")?.name).toBe("Sam L.");
    expect(people.get("3")?.name).toBe("Sam C.");
    expect(people.get("4")?.name).toBe("Sam T.");
  });

  it("keeps custom entry names and shortens unique default ones", () => {
    expect(people.get("5")?.name).toBe("Moody");
    expect(people.get("6")?.name).toBe("Chris");
    expect(people.get("7")?.name).toBe("Jake");
    expect(people.get("8")?.name).toBe("lonely");
    expect(people.get("9")?.name).toBe("Nancy");
  });

  it("keeps the username as a second clue and gives stable initials", () => {
    expect(people.get("1")?.username).toBe("sammandelbaum");
    expect(people.get("1")?.initials).toBe("SM");
    expect(people.get("5")?.initials).toBe("M");
    expect(buildPeople([e("1", "x", "y")]).get("1")?.color).toBe(people.get("1")?.color);
  });
});

describe("initialsOf", () => {
  it("skips numbers and possessives", () => {
    expect(initialsOf("Fin Fader 69420")).toBe("FF");
    expect(initialsOf("Sturdy’s Picks")).toBe("SP");
  });
});
