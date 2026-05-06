#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { program } from "commander";
import { registerInstallCommand } from "./commands/install.js";
import { registerInstallStatuslineCommand } from "./commands/install-statusline.js";
import { registerUninstallCommand } from "./commands/uninstall.js";
import { registerUninstallStatuslineCommand } from "./commands/uninstall-statusline.js";
import { registerIngestCommand } from "./commands/ingest.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerRecallCommand } from "./commands/recall.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerDoctorCommand } from "./commands/doctor.js";

function readPackageVersion(): string {
  try {
    const pkgPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "package.json",
    );
    const pkg: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (
      typeof pkg === "object" &&
      pkg !== null &&
      "version" in pkg &&
      typeof pkg.version === "string"
    ) {
      return pkg.version;
    }
  } catch {
    // Best-effort — return fallback
  }
  return "unknown";
}

program
  .name("brv-claude-plugin")
  .description(
    "Native bridge between ByteRover context engine and Claude Code auto-memory",
  )
  .version(readPackageVersion());

registerInstallCommand(program);
registerInstallStatuslineCommand(program);
registerUninstallCommand(program);
registerUninstallStatuslineCommand(program);
registerIngestCommand(program);
registerSyncCommand(program);
registerRecallCommand(program);
registerStatusCommand(program);
registerDoctorCommand(program);

program.parse();
