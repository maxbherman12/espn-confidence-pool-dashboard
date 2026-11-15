/**
 * Names you actually call people, keyed by ESPN username (the account name,
 * not the entry name). Matching ignores case.
 *
 * Anyone not listed gets a smart default: their custom entry name, or for a
 * default entry like "Sam's 1st Entry", the first name plus an initial when
 * several people share it ("Sam M.", "Sam L."). Add a line here to override.
 *
 * Example:
 *   sammandelbaum: "Sam Mandelbaum",
 */
export const NICKNAMES: Record<string, string> = {};
