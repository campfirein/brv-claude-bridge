import { describe, it, expect } from "vitest";
import {
  diagnoseStatuslineConflict,
  isPromptCancelled,
  setStatuslineEntry,
} from "../src/commands/install-statusline.js";

describe("diagnoseStatuslineConflict", () => {
  it("returns 'absent' when settings has no statusLine", () => {
    expect(diagnoseStatuslineConflict({})).toBe("absent");
  });

  it("returns 'ours' when statusLine.command carries the bridge marker", () => {
    expect(
      diagnoseStatuslineConflict({
        statusLine: {
          type: "command",
          command: "node /x/dist/cli.js status #brv-claude-plugin",
        },
      }),
    ).toBe("ours");
  });

  it("returns 'foreign' when a different statusLine is configured", () => {
    expect(
      diagnoseStatuslineConflict({
        statusLine: {
          type: "command",
          command: "~/.claude/my-statusline.sh",
        },
      }),
    ).toBe("foreign");
  });

  it("returns 'foreign' when statusLine is malformed (object without command)", () => {
    expect(
      diagnoseStatuslineConflict({
        statusLine: { type: "command" },
      }),
    ).toBe("foreign");
  });
});

describe("setStatuslineEntry", () => {
  it("writes a statusLine pointing at our command with a 5s refreshInterval", () => {
    const settings: Record<string, unknown> = {};
    const out = setStatuslineEntry(settings, "node /x/cli.js status #brv-claude-plugin");
    expect(out.statusLine).toEqual({
      type: "command",
      command: "node /x/cli.js status #brv-claude-plugin",
      refreshInterval: 5,
    });
  });

  it("does not include padding (omitted to accept Claude Code default)", () => {
    const out = setStatuslineEntry({}, "cmd #brv-claude-plugin");
    const sl = out.statusLine as Record<string, unknown>;
    expect("padding" in sl).toBe(false);
  });

  it("preserves unrelated settings fields", () => {
    const settings = {
      hooks: { Stop: [] },
      env: { FOO: "1" },
    };
    const out = setStatuslineEntry(settings, "cmd #brv-claude-plugin");
    expect(out.hooks).toEqual({ Stop: [] });
    expect(out.env).toEqual({ FOO: "1" });
  });

  it("overwrites a foreign statusLine when called", () => {
    const settings = {
      statusLine: { type: "command", command: "~/old.sh", padding: 2 },
    };
    const out = setStatuslineEntry(settings, "cmd #brv-claude-plugin");
    expect(out.statusLine).toEqual({
      type: "command",
      command: "cmd #brv-claude-plugin",
      refreshInterval: 5,
    });
  });
});

describe("isPromptCancelled", () => {
  it("returns true for an Error named 'ExitPromptError' (Ctrl+C in @inquirer/prompts)", () => {
    const err = new Error("User aborted");
    err.name = "ExitPromptError";
    expect(isPromptCancelled(err)).toBe(true);
  });

  it("returns true for an Error whose message mentions 'force closed' (alternate inquirer signal)", () => {
    expect(isPromptCancelled(new Error("Prompt was force closed"))).toBe(true);
  });

  it("returns false for an unrelated Error", () => {
    expect(isPromptCancelled(new Error("ENOENT"))).toBe(false);
  });

  it("returns false for non-Error values (string / undefined / null)", () => {
    expect(isPromptCancelled("not an error")).toBe(false);
    expect(isPromptCancelled(undefined)).toBe(false);
    expect(isPromptCancelled(null)).toBe(false);
  });
});
