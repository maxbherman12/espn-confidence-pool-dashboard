import { NICKNAMES } from "@/config/nicknames";

/**
 * ESPN sends two names per entry: the pool entry name (`entry.name`) and the
 * member's ESPN account name (`member.displayName`). Most people never rename
 * their entry, so a pool fills up with "Sam's 1st Entry" four times over.
 * `buildPeople` turns that into names people can tell apart.
 */

export interface Person {
  entryId: string;
  /** What to show. */
  name: string;
  /** ESPN username, shown underneath as a second clue. */
  username: string;
  initials: string;
  /** Avatar colour, stable per entry. */
  color: string;
}

/** Matches ESPN's default entry names: "Sam's 1st Entry", "Chris' 2nd Entry". */
const DEFAULT_ENTRY = /^(.+?)\s*['’]s?\s+\d+(?:st|nd|rd|th)\s+entry$/i;

/**
 * Avatar palette. Blue is left out on purpose: it is reserved for "you".
 * Every colour carries white text at 4.5:1 or better.
 */
const PALETTE = [
  "#db2777",
  "#047857",
  "#c2410c",
  "#7c3aed",
  "#dc2626",
  "#0e7490",
  "#4d7c0f",
  "#a21caf",
  "#b45309",
  "#be123c",
];

/** The name to show for an entry when no others are known: entry name first. */
export function entryLabel(entryName: string, displayName: string): string {
  const entry = entryName.trim();
  if (entry) return entry;
  const account = displayName.trim();
  if (account && account !== "Unknown") return account;
  return "Unknown";
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name: string): string {
  const words = name
    .replace(/['’]s\b/gi, "")
    .split(/[\s._-]+/)
    .filter((w) => /[a-z]/i.test(w));
  if (words.length === 0) return name.slice(0, 1).toUpperCase() || "?";
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[1][0]];
  return letters.join("").toUpperCase();
}

/**
 * A distinguishing initial for one of several people with the same first name,
 * drawn from their ESPN username: "sammandelbaum" -> M, "Sam Leibner" -> L,
 * "sam.crown" -> C, "Truu Skillz" -> T.
 */
function initialFromUsername(first: string, username: string): string {
  const u = username.trim();
  const lower = u.toLowerCase();
  const f = first.toLowerCase();
  if (lower.startsWith(f)) {
    const rest = u.slice(f.length).replace(/[^a-z]/gi, "");
    if (rest) return rest[0].toUpperCase();
  }
  const letter = u.replace(/[^a-z]/gi, "")[0];
  return letter ? letter.toUpperCase() : "";
}

interface EntryNames {
  entryId: string;
  entryName: string;
  displayName: string;
}

/**
 * Names for every entry in a pool, resolved together because telling the four
 * Sams apart needs to know about all of them.
 */
export function buildPeople(entries: EntryNames[]): Map<string, Person> {
  const nick = new Map(
    Object.entries(NICKNAMES).map(([k, v]) => [k.trim().toLowerCase(), v]),
  );

  const draft = entries.map((e) => {
    const username = e.displayName.trim();
    const entryName = e.entryName.trim();
    const nickname = nick.get(username.toLowerCase());
    if (nickname) return { e, username, name: nickname, first: null as string | null };
    const m = DEFAULT_ENTRY.exec(entryName);
    if (m) {
      const raw = m[1].trim();
      const first = raw.charAt(0).toUpperCase() + raw.slice(1);
      return { e, username, name: first, first };
    }
    if (entryName) return { e, username, name: entryName, first: null };
    return { e, username, name: username || "Unknown", first: null };
  });

  // Default-named entries whose first name collides with another entry get an
  // initial; anything still colliding falls back to the username.
  const count = (key: string) =>
    draft.filter((d) => d.name.toLowerCase() === key.toLowerCase()).length;
  // Decide who collides before renaming anyone, or the last Sam would see no
  // other "Sam" left and keep the bare name.
  const colliding = draft.map((d) => Boolean(d.first && count(d.first) > 1));
  for (const [i, d] of draft.entries()) {
    if (d.first && colliding[i]) {
      const initial = initialFromUsername(d.first, d.username);
      d.name = initial ? `${d.first} ${initial}.` : d.first;
    }
  }
  for (const d of draft) {
    if (count(d.name) > 1 && d.username) d.name = `${d.name} (${d.username})`;
  }

  return new Map(
    draft.map((d) => [
      d.e.entryId,
      {
        entryId: d.e.entryId,
        name: d.name,
        username: d.username,
        initials: initialsOf(d.name),
        color: PALETTE[hash(d.e.entryId) % PALETTE.length],
      },
    ]),
  );
}
