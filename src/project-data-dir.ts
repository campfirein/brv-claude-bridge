import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * Mirrors byterover-cli's project data dir resolution. Kept narrowly in sync
 * with byterover-cli's `src/server/utils/path-utils.ts` and
 * `src/server/utils/global-data-path.ts` so we can locate per-project artifacts
 * (curate-log, query-log) the daemon writes outside the project's own `.brv/`.
 *
 * Daemon contract reproduced here:
 *   <getGlobalDataDir()>/projects/<sanitizeProjectPath(realpath(cwd))>/
 *
 * If the daemon ever changes either function, this module must be updated in
 * lockstep — there is no runtime contract enforcing parity.
 */

const GLOBAL_DATA_DIR = "brv";
const GLOBAL_PROJECTS_DIR = "projects";
const MAX_SANITIZED_LENGTH = 200;
const HASH_SUFFIX_LENGTH = 12;

const WINDOWS_ILLEGAL_CHARS: ReadonlyMap<string, string> = new Map([
  ['"', "%22"],
  ["*", "%2A"],
  [":", "%3A"],
  ["<", "%3C"],
  [">", "%3E"],
  ["?", "%3F"],
  ["|", "%7C"],
]);

export function getGlobalDataDir(): string {
  if (process.env.BRV_DATA_DIR !== undefined && process.env.BRV_DATA_DIR !== "") {
    return process.env.BRV_DATA_DIR;
  }
  const p = platform();
  if (p === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData !== undefined && localAppData !== "") {
      return join(localAppData, GLOBAL_DATA_DIR);
    }
    return join(homedir(), "AppData", "Local", GLOBAL_DATA_DIR);
  }
  if (p === "darwin") {
    return join(homedir(), "Library", "Application Support", GLOBAL_DATA_DIR);
  }
  if (p === "linux") {
    const xdgDataHome = process.env.XDG_DATA_HOME;
    if (xdgDataHome !== undefined && xdgDataHome !== "") {
      return join(xdgDataHome, GLOBAL_DATA_DIR);
    }
  }
  return join(homedir(), ".local", "share", GLOBAL_DATA_DIR);
}

export function sanitizeProjectPath(resolvedPath: string): string {
  const normalized = resolvedPath.replace(/^([A-Za-z]):/, "$1");
  const components = normalized.split(/[/\\]+/).filter(Boolean);
  const encoded = components.map((c) => {
    let result = c.replaceAll("%", "%25").replaceAll("--", "%2D%2D");
    for (const [char, replacement] of WINDOWS_ILLEGAL_CHARS) {
      result = result.replaceAll(char, replacement);
    }
    return result;
  });
  const joined = encoded.join("--");
  if (joined.length <= MAX_SANITIZED_LENGTH) {
    return joined;
  }
  const hash = createHash("sha256")
    .update(joined)
    .digest("hex")
    .slice(0, HASH_SUFFIX_LENGTH);
  const prefixLength = MAX_SANITIZED_LENGTH - HASH_SUFFIX_LENGTH - 3;
  return joined.slice(0, prefixLength) + "---" + hash;
}

/**
 * `<getGlobalDataDir()>/projects/<sanitizeProjectPath(realpath(cwd))>/`
 * Throws if `cwd` does not exist (matches daemon's `realpathSync` semantics).
 */
export function getProjectDataDir(cwd: string): string {
  const resolved = realpathSync(cwd);
  return join(getGlobalDataDir(), GLOBAL_PROJECTS_DIR, sanitizeProjectPath(resolved));
}
