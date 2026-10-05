/**
 * ESPN sends two names per entry: the pool entry name (`entry.name`) and the
 * member's ESPN account name (`member.displayName`). The entry name is the one
 * people recognise — it is what the pool itself lists — so that is what the UI
 * shows, with the account name kept as a fallback and as the hover tooltip.
 *
 * Neither field is optional in practice: normalize defaults `displayName` to
 * "Unknown" and `entryName` to "", so both are handled.
 */

/** The name to show for an entry: entry name first, ESPN account name second. */
export function entryLabel(entryName: string, displayName: string): string {
  const entry = entryName.trim();
  if (entry) return entry;
  const account = displayName.trim();
  if (account && account !== "Unknown") return account;
  return entryName.trim() || displayName.trim() || "Unknown";
}

/**
 * The other name for an entry, for hover tooltips: the ESPN account name when
 * the entry name is what gets shown, and vice versa. Undefined when there is
 * nothing extra to reveal.
 */
export function entryAltName(entryName: string, displayName: string): string | undefined {
  const label = entryLabel(entryName, displayName);
  const alt = label === entryName.trim() ? displayName.trim() : entryName.trim();
  return alt && alt !== label ? alt : undefined;
}

/** True when `name` (user-entered identity) identifies this entry by either name. */
export function matchesEntryName(
  entry: { entryName: string; displayName: string },
  name: string,
): boolean {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return false;
  return [entry.entryName, entry.displayName].some(
    (candidate) => candidate.trim().toLowerCase() === wanted,
  );
}