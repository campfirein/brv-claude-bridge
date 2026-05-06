import type { Command } from "commander";

import { formatStatusLine } from "../format-status-line.js";
import { detectState, findBrvDir } from "../state-detector.js";

/**
 * Given a parsed Claude Code status payload (or any value), return the line to
 * print on stdout, or `""` when no `.brv/` project is reachable from the
 * resolved cwd. Empty stdout tells Claude Code to hide the status line.
 *
 * `input` is `unknown` so empty/malformed stdin is graceful — when the value
 * is not a usable object, we fall back to `process.cwd()`.
 */
export function produceStatusLine(input: unknown): string {
  const cwd = resolveCwd(input);
  const brvDir = findBrvDir(cwd);
  if (brvDir === undefined) return "";
  return formatStatusLine(detectState(brvDir, cwd));
}

function resolveCwd(input: unknown): string {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const workspace = obj.workspace;
    if (typeof workspace === "object" && workspace !== null) {
      const wsDir = (workspace as Record<string, unknown>).current_dir;
      if (typeof wsDir === "string" && wsDir.length > 0) return wsDir;
    }
    if (typeof obj.cwd === "string" && obj.cwd.length > 0) return obj.cwd;
  }
  return process.cwd();
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description(
      "Print the byterover status line for Claude Code (reads CC status payload from stdin)",
    )
    .action(async () => {
      const raw = await readAllStdin();
      let input: unknown;
      try {
        input = raw ? JSON.parse(raw) : undefined;
      } catch {
        input = undefined;
      }
      const line = produceStatusLine(input);
      if (line.length > 0) {
        process.stdout.write(line + "\n");
      }
      process.exit(0);
    });
}

async function readAllStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}
