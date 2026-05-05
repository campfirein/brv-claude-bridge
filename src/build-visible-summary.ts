/**
 * Format the visible "ByteRover returns N memories: …" line that the
 * UserPromptSubmit hook emits via `systemMessage`. Pure function so it can
 * be unit-tested without filesystem or clock dependencies — the caller is
 * responsible for resolving each entry's age before calling.
 */

export interface VisibleSummaryEntry {
  /** Path as it should be rendered. Caller is responsible for stripping the .brv/context-tree/ prefix. */
  path: string;
  /** Last-modified (or originally-curated) date; omit when no signal is available. */
  age?: Date;
}

export interface BuildVisibleSummaryOptions {
  /** Override the reference clock for deterministic age computation in tests. */
  now?: Date;
}

const MAX_ENTRIES = 3;
const MS_PER_DAY = 86_400_000;

export function buildVisibleSummary(
  entries: readonly VisibleSummaryEntry[],
  options?: BuildVisibleSummaryOptions,
): string {
  if (entries.length === 0) return "";

  const shown = entries.slice(0, MAX_ENTRIES);
  const now = options?.now ?? new Date();
  const noun = shown.length === 1 ? "memory" : "memories";
  const items = shown.map((entry) => renderEntry(entry, now)).join(", ");

  return `🧠 ByteRover returns ${shown.length} ${noun}: ${items}`;
}

function renderEntry(entry: VisibleSummaryEntry, now: Date): string {
  if (!entry.age) return entry.path;

  const elapsedMs = now.getTime() - entry.age.getTime();
  // Defensive: future-dated entries (clock skew, bad frontmatter) get rendered without an age tag
  // rather than something nonsensical like "-5d ago".
  if (elapsedMs < 0) return entry.path;

  return `${entry.path} (${humanizeAge(elapsedMs)})`;
}

function humanizeAge(elapsedMs: number): string {
  const days = Math.floor(elapsedMs / MS_PER_DAY);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
