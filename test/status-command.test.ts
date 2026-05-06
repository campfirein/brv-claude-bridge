import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { produceStatusLine } from "../src/commands/status.js";
import { formatStatusLine } from "../src/format-status-line.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "brv-statuscmd-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function makeBrv(dir: string): string {
  const brvDir = join(dir, ".brv");
  mkdirSync(brvDir, { recursive: true });
  return brvDir;
}

describe("produceStatusLine", () => {
  it("returns empty string when no .brv ancestor exists", () => {
    expect(produceStatusLine({ cwd: root })).toBe("");
  });

  it("uses workspace.current_dir when present (preferred per CC docs)", () => {
    const brvDir = makeBrv(root);
    writeFileSync(join(brvDir, "dream.lock"), "{}", "utf8");
    expect(
      produceStatusLine({ workspace: { current_dir: root }, cwd: "/wrong" }),
    ).toBe(formatStatusLine("dreaming"));
  });

  it("falls back to top-level cwd when workspace.current_dir is absent", () => {
    makeBrv(root);
    expect(produceStatusLine({ cwd: root })).toBe(formatStatusLine("idle"));
  });

  it("falls back to process.cwd() when no input is provided", () => {
    const original = process.cwd();
    process.chdir(root);
    try {
      makeBrv(root);
      expect(produceStatusLine(undefined)).toBe(formatStatusLine("idle"));
    } finally {
      process.chdir(original);
    }
  });

  it("treats malformed/non-object input as no-input (uses process.cwd())", () => {
    const original = process.cwd();
    process.chdir(root);
    try {
      // No .brv anywhere reachable → empty.
      expect(produceStatusLine("not an object")).toBe("");
    } finally {
      process.chdir(original);
    }
  });
});
