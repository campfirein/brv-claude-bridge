import { describe, it, expect } from "vitest";
import { removeOurStatusline } from "../src/commands/uninstall-statusline.js";

describe("removeOurStatusline", () => {
  it("removes the statusLine entry when it carries our marker", () => {
    const settings: Record<string, unknown> = {
      statusLine: {
        type: "command",
        command: "node /x/cli.js status #brv-claude-plugin",
      },
      hooks: { Stop: [] },
    };
    const removed = removeOurStatusline(settings);
    expect(removed).toBe(true);
    expect(settings.statusLine).toBeUndefined();
    expect(settings.hooks).toEqual({ Stop: [] });
  });

  it("leaves a foreign statusLine intact and returns false", () => {
    const settings: Record<string, unknown> = {
      statusLine: { type: "command", command: "~/my-line.sh" },
    };
    const removed = removeOurStatusline(settings);
    expect(removed).toBe(false);
    expect(settings.statusLine).toEqual({
      type: "command",
      command: "~/my-line.sh",
    });
  });

  it("returns false when no statusLine is present", () => {
    const settings: Record<string, unknown> = { hooks: {} };
    expect(removeOurStatusline(settings)).toBe(false);
    expect(settings.hooks).toEqual({});
  });

  it("returns false on a malformed statusLine and leaves it intact", () => {
    const settings: Record<string, unknown> = {
      statusLine: { type: "command" },
    };
    expect(removeOurStatusline(settings)).toBe(false);
    expect(settings.statusLine).toEqual({ type: "command" });
  });
});
