import { join } from "node:path";

import { select } from "@inquirer/prompts";
import type { Command } from "commander";
import pc from "picocolors";

import {
  buildHookCommand,
  isBridgeHook,
  resolveBridgeExecutable,
} from "../bridge-command.js";
import { getClaudeConfigHome } from "../memory-path.js";
import {
  backupSettings,
  readSettingsRaw,
  writeSettingsRaw,
} from "../schemas/cc-settings.js";

export type StatuslineConflictState = "absent" | "ours" | "foreign";

type InstallStatuslineOpts = {
  dryRun?: boolean;
  force?: boolean;
  settingsPath?: string;
};

/**
 * Inspect a settings.json object and classify the existing `statusLine` entry:
 *   - "absent":  no `statusLine` field
 *   - "ours":    `statusLine.command` carries our bridge marker
 *   - "foreign": some other statusLine is configured (or malformed)
 */
export function diagnoseStatuslineConflict(
  settings: Record<string, unknown>,
): StatuslineConflictState {
  const sl = settings.statusLine;
  if (sl === undefined) return "absent";
  if (typeof sl === "object" && sl !== null) {
    const obj = sl as Record<string, unknown>;
    if (typeof obj.command === "string" && isBridgeHook({ command: obj.command })) {
      return "ours";
    }
  }
  return "foreign";
}

/** Re-run cadence (seconds) on top of Claude Code's event-driven triggers. */
const REFRESH_INTERVAL_SECONDS = 5;

/**
 * Set our `statusLine` entry on a settings object. Padding is intentionally
 * omitted so Claude Code's default applies. `refreshInterval` is set so the
 * line reflects daemon-side state changes (curate, dream) that happen while
 * the assistant is mid-tool-call — Claude Code's event triggers don't fire
 * during those windows. Mutates and returns `settings`.
 */
export function setStatuslineEntry(
  settings: Record<string, unknown>,
  command: string,
): Record<string, unknown> {
  settings.statusLine = {
    type: "command",
    command,
    refreshInterval: REFRESH_INTERVAL_SECONDS,
  };
  return settings;
}

export function registerInstallStatuslineCommand(program: Command): void {
  program
    .command("install-statusline")
    .description(
      "Install the byterover status line into Claude Code (opt-in)",
    )
    .option("--dry-run", "Show what would be written without modifying files")
    .option("--force", "Overwrite an existing foreign statusLine without prompting")
    .option(
      "--settings-path <path>",
      "Override path to Claude Code settings.json",
    )
    .action(async (opts: InstallStatuslineOpts) => {
      try {
        const exe = resolveBridgeExecutable();
        console.log(pc.dim(`Resolved executable: ${exe}`));

        const settingsPath =
          opts.settingsPath ?? join(getClaudeConfigHome(), "settings.json");
        const settings = readSettingsRaw(settingsPath);

        const state = diagnoseStatuslineConflict(settings);
        const command = buildHookCommand("status");

        if (state === "ours") {
          // Compare current entry to what we'd write. If identical, no-op.
          // If our shape has drifted (e.g. plugin upgrade added refreshInterval),
          // upgrade in place — backup + rewrite.
          const expected = { type: "command", command, refreshInterval: REFRESH_INTERVAL_SECONDS };
          if (JSON.stringify(settings.statusLine) === JSON.stringify(expected)) {
            console.log(
              pc.yellow("Status line already installed. No changes made."),
            );
            return;
          }
          // Falls through to write path below — the install message will read "upgraded".
        }

        if (state === "foreign") {
          const decision = await resolveForeignConflict(opts);
          if (decision === "abort") {
            console.log(
              pc.yellow("Aborted. Existing statusLine left in place."),
            );
            process.exit(1);
          }
          if (decision === "keep") {
            console.log(
              pc.yellow("Keeping existing statusLine. No changes made."),
            );
            return;
          }
          // decision === "replace" — fall through
        }

        setStatuslineEntry(settings, command);

        if (opts.dryRun) {
          console.log(pc.cyan("Dry run — would write:"));
          console.log(JSON.stringify(settings, null, 2));
          return;
        }

        const backupPath = backupSettings(settingsPath);
        console.log(pc.dim(`Backup: ${backupPath}`));

        writeSettingsRaw(settingsPath, settings);

        console.log(
          pc.green(`Installed status line into ${settingsPath}`),
        );
        console.log(pc.dim(`Command: ${command}`));
      } catch (err) {
        if (isPromptCancelled(err)) {
          console.log(pc.yellow("\nAborted."));
          process.exit(1);
        }
        console.error(
          pc.red(
            `Install failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }
    });
}

type ConflictDecision = "keep" | "replace" | "abort";

async function resolveForeignConflict(
  opts: InstallStatuslineOpts,
): Promise<ConflictDecision> {
  if (opts.force) return "replace";
  if (!process.stdin.isTTY) {
    console.error(
      pc.red(
        "An existing statusLine is configured. Re-run with --force to overwrite, " +
          "or remove it first.",
      ),
    );
    process.exit(1);
  }
  return select<ConflictDecision>({
    message: "An existing statusLine is configured. What should I do?",
    choices: [
      { name: "Abort — leave it alone (default)", value: "abort" },
      { name: "Keep existing — install nothing", value: "keep" },
      { name: "Replace with byterover's status line", value: "replace" },
    ],
    default: "abort",
  });
}

export function isPromptCancelled(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "ExitPromptError" || err.message.includes("force closed"))
  );
}
