import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import yaml from "js-yaml";

/**
 * Resolve the "age" of a context-tree document for the visible recall summary.
 *
 * Resolution order, falling through on any failure:
 *   1. Frontmatter `updatedAt`   — standard topic files (post-curate timestamp)
 *   2. Frontmatter `synthesized_at` — synthesis files produced by `brv dream`
 *   3. Frontmatter `createdAt`   — older standard files that lack updatedAt
 *   4. File `mtime`              — last resort for files without timestamp frontmatter
 *   5. `undefined`               — file missing or path is a cross-project shared source
 *
 * Cross-project paths in the form `[alias]:relative/path.md` are not resolved here —
 * they live in another project's `.brv/context-tree/`, which the plugin does not see.
 */
export function resolveContextTreeAge(
  projectRoot: string,
  relativePath: string,
): Date | undefined {
  // Shared-source paths point outside this project tree; we have no access to their mtime.
  if (relativePath.startsWith("[")) return undefined;

  const absolutePath = join(projectRoot, ".brv", "context-tree", relativePath);

  let mtime: Date | undefined;
  try {
    mtime = statSync(absolutePath).mtime;
  } catch {
    // File missing or unreadable — no age to surface.
    return undefined;
  }

  const frontmatterAge = readFrontmatterAge(absolutePath);
  return frontmatterAge ?? mtime;
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
const TIMESTAMP_KEYS_IN_PRIORITY: ReadonlyArray<string> = [
  "updatedAt",
  "synthesized_at",
  "createdAt",
];

function readFrontmatterAge(absolutePath: string): Date | undefined {
  let head: string;
  try {
    // Frontmatter sits at the top of the file; reading the whole file is fine for context-tree
    // documents (typically <50KB) and avoids the complexity of streaming a partial read.
    head = readFileSync(absolutePath, "utf8");
  } catch {
    return undefined;
  }

  const match = head.match(FRONTMATTER_REGEX);
  if (!match) return undefined;

  let parsed: unknown;
  try {
    parsed = yaml.load(match[1] ?? "");
  } catch {
    return undefined;
  }

  if (!isPlainObject(parsed)) return undefined;

  for (const key of TIMESTAMP_KEYS_IN_PRIORITY) {
    const candidate = parsed[key];
    const date = coerceDate(candidate);
    if (date) return date;
  }

  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function coerceDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}
