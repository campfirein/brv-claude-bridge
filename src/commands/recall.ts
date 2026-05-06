import type { Command } from "commander";
import { BrvBridge } from "@byterover/brv-bridge";
import { buildRecallOutput } from "../build-recall-output.js";
import { UserPromptSubmitHookInputSchema } from "../schemas/cc-hook-input.js";
import { readStdinJson } from "../stdin.js";

export function registerRecallCommand(program: Command): void {
  program
    .command("recall")
    .description(
      "Query ByteRover for context relevant to the user prompt (called by UserPromptSubmit hook)",
    )
    .action(async () => {
      try {
        const input = await readStdinJson(UserPromptSubmitHookInputSchema);
        const { prompt, cwd } = input;

        // Skip trivially short prompts
        if (prompt.trim().length < 5) {
          process.exit(0);
        }

        // Query ByteRover with the actual user prompt. Newer brv CLIs return
        // matchedDocs/tier/timing alongside content; older CLIs return content only, and
        // buildRecallOutput falls back to parsing the **Sources** block in that case.
        const bridge = new BrvBridge({ cwd, recallTimeoutMs: 6_000 });
        const { content, matchedDocs } = await bridge.recall(prompt);

        const output = buildRecallOutput({ content, matchedDocs, cwd });
        if (!output) {
          // No content retrieved — exit silently without injecting anything.
          process.exit(0);
        }

        console.log(JSON.stringify(output));
        process.exit(0);
      } catch {
        // All errors → silent exit 0. Never block the prompt.
        process.exit(0);
      }
    });
}
