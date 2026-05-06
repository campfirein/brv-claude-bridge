import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { getProjectDataDir } from "./project-data-dir.js";

export type BrvState = "dreaming" | "curating" | "idle";

/**
 * Maximum age we will trust the standalone `dream.lock` signal. Beyond this
 * the lock is treated as stale and discarded — the daemon has been observed
 * to leave locks behind on abnormal exit, so a very old lock is more likely
 * to be a leftover than a still-running dream.
 *
 * Set to 15 minutes: comfortably above the longest dream observed in this
 * project's logs (~10 min) plus headroom for slower providers / bigger
 * trees, but short enough that a stuck false-positive self-heals within a
 * reasonable window. Tune later if real dreams exceed this on other projects.
 */
const STALE_LOCK_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Walk up from `startCwd` looking for a `.brv` directory.
 * Returns the absolute path to `.brv` when found, or undefined when no
 * ancestor contains one. Closest match wins.
 */
export function findBrvDir(startCwd: string): string | undefined {
  let dir = startCwd;
  while (true) {
    const candidate = join(dir, ".brv");
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Inspect the daemon's persisted activity and classify the project state.
 * Pure filesystem inspection — no daemon RPC.
 *
 * Two storage locations are checked because the daemon writes them in
 * different baseDirs (project-local vs global):
 *   - dream-log + dream.lock → `<brvDir>/dream-log/`, `<brvDir>/dream.lock`
 *   - curate-log              → `<getProjectDataDir(cwd)>/curate-log/`
 *
 * Precedence (confident signals first, weak signals last):
 *   1. dream-log latest === "processing"        → dreaming  (confident)
 *   2. curate-log latest === "processing"       → curating  (confident)
 *   3. dream.lock present, fresh, log isn't "completed"  → dreaming  (weak fallback)
 *   4. otherwise                                → idle
 *
 * Confident signals (active log entries) outrank the weak dream.lock fallback
 * so that an active curate isn't masked by a stale dream.lock. Real concurrent
 * dream + curate is preserved (rule 1 wins). Stale-lock false-positives are
 * bounded by `STALE_LOCK_THRESHOLD_MS`.
 *
 * `cwd` is needed to resolve the daemon's per-project storage directory; it
 * defaults to the parent of `brvDir` (the project root).
 */
export function detectState(brvDir: string, cwd?: string): BrvState {
  const lockPath = join(brvDir, "dream.lock");
  const lockExists = existsSync(lockPath);
  const latestDream = latestLogStatus(join(brvDir, "dream-log"));

  // Rule 1 — confident dream signal
  if (latestDream === "processing") return "dreaming";

  // Rule 2 — confident curate signal, beats the weak dream.lock fallback
  const projectCwd = cwd ?? dirname(brvDir);
  let projectDataDir: string | undefined;
  try {
    projectDataDir = getProjectDataDir(projectCwd);
  } catch {
    projectDataDir = undefined;
  }
  if (projectDataDir !== undefined) {
    if (latestLogStatus(join(projectDataDir, "curate-log")) === "processing") {
      return "curating";
    }
  }

  // Rule 3 — dream.lock fallback. Honored only when:
  //   (a) latest dream-log isn't already "completed" (cross-check)
  //   (b) lock is fresh (within STALE_LOCK_THRESHOLD_MS)
  if (lockExists && latestDream !== "completed" && lockIsFresh(lockPath)) {
    return "dreaming";
  }

  return "idle";
}

function lockIsFresh(lockPath: string): boolean {
  try {
    const stat = statSync(lockPath);
    return Date.now() - stat.mtimeMs < STALE_LOCK_THRESHOLD_MS;
  } catch {
    return false;
  }
}

/** Returns the `status` field of the lex-most-recent *.json log in `logDir`. */
function latestLogStatus(logDir: string): string | undefined {
  let entries: string[];
  try {
    entries = readdirSync(logDir);
  } catch {
    return undefined;
  }
  const jsonFiles = entries.filter((e) => e.endsWith(".json")).sort();
  const latest = jsonFiles.at(-1);
  if (latest === undefined) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(logDir, latest), "utf8"));
  } catch {
    return undefined;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "status" in parsed &&
    typeof (parsed as { status?: unknown }).status === "string"
  ) {
    return (parsed as { status: string }).status;
  }
  return undefined;
}
