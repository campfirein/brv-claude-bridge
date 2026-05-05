/**
 * Plugin-only fallback for extracting source paths from a synthesized recall response.
 *
 * Used when the brv CLI does not surface `matchedDocs` in the
 * `brv query --format json` envelope. All five resolution tiers in the CLI emit a
 * `**Sources**:` block in the synthesized content (the format is locked in by the
 * synthesis prompt's `responseFormat` rules and grounding rules), so we can recover paths
 * by parsing the content. When the CLI is current we use `matchedDocs` directly and skip
 * this parser entirely.
 *
 * Returns an empty array on any of:
 * - No `**Sources**:` block at all
 * - `**Sources**: None` (Tier 2 not-found)
 * - Block exists but contains no extractable list items
 */

const PREFIX_TO_STRIP = ".brv/context-tree/";

// Capture from "**Sources**:" through the next blank-line-then-heading boundary OR end of string.
// Backticked items are isolated by a non-greedy capture; non-list lines after Sources end the block.
const SOURCES_BLOCK_REGEX = /\*\*Sources\*\*:\s*\n([\s\S]*?)(?:\n\s*\n|$)/;
const LIST_ITEM_REGEX = /^\s*-\s*`([^`]+)`/gm;

export function parseSourcesFromContent(content: string): string[] {
  if (!content) return [];

  const blockMatch = content.match(SOURCES_BLOCK_REGEX);
  if (!blockMatch) return [];

  const block = blockMatch[1] ?? "";
  // "Sources: None" inline (no list items) → empty
  if (/^\s*None\s*$/i.test(block)) return [];

  const paths: string[] = [];
  for (const itemMatch of block.matchAll(LIST_ITEM_REGEX)) {
    const raw = itemMatch[1] ?? "";
    paths.push(stripPrefix(raw));
  }

  return paths;
}

function stripPrefix(path: string): string {
  return path.startsWith(PREFIX_TO_STRIP)
    ? path.slice(PREFIX_TO_STRIP.length)
    : path;
}
