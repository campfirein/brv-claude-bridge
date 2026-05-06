import { join } from "node:path";

import type { Command } from "commander";
import pc from "picocolors";

import { isBridgeHook } from "../bridge-command.js";
import { getClaudeConfigHome } from "../memory-path.js";
import {
  backupSettings,
  readSettingsRaw,
  writeSettingsRaw,
} from "../schemas/cc-settings.js";

type UninstallStatuslineOpts = {
  settingsPath?: string;
};

/**
 * Remove the `statusLine` entry from a settings object only when it carries
 * our bridge marker. Returns true when removed, false otherwise (foreign
 * statusLines are left alone). Mutates `settings`.
 */
export function removeOurStatusline(settings: Record<string, unknown>): boolean {
  const sl = settings.statusLine;
  if (sl === undefined) return false;
  if (typeof sl !== "object" || sl === null) return false;
  const obj = sl as Record<string, unknown>;
  if (typeof obj.command !== "string") return false;
  if (!isBridgeHook({ command: obj.command })) return false;
  delete settings.statusLine;
  return true;
}

export function registerUninstallStatuslineCommand(program: Command): void {
  program
    .command("uninstall-statusline")
    .description(
      "Remove the byterover status line from Claude Code settings (leaves foreign statusLines alone)",
    )
    .option(
      "--settings-path <path>",
      "Override path to Claude Code settings.json",
    )
    .action(async (opts: UninstallStatuslineOpts) => {
      try {
        const settingsPath =
          opts.settingsPath ?? join(getClaudeConfigHome(), "settings.json");
        const settings = readSettingsRaw(settingsPath);

        const removed = removeOurStatusline(settings);

        if (!removed) {
          if (settings.statusLine !== undefined) {
            console.log(
              pc.yellow(
                "Existing statusLine is not ours. Leaving it untouched.",
              ),
            );
          } else {
            console.log(pc.yellow("No status line installed. Nothing to remove."));
          }
          return;
        }

        backupSettings(settingsPath);
        writeSettingsRaw(settingsPath, settings);

        console.log(pc.green(`Removed status line from ${settingsPath}`));
      } catch (err) {
        console.error(
          pc.red(
            `Uninstall failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }
    });
}
