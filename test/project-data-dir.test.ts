import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import {
  getGlobalDataDir,
  getProjectDataDir,
  sanitizeProjectPath,
} from "../src/project-data-dir.js";

let dataDir: string;
let prevEnv: string | undefined;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "brv-data-"));
  prevEnv = process.env.BRV_DATA_DIR;
  process.env.BRV_DATA_DIR = dataDir;
});

afterEach(() => {
  if (prevEnv === undefined) {
    delete process.env.BRV_DATA_DIR;
  } else {
    process.env.BRV_DATA_DIR = prevEnv;
  }
  rmSync(dataDir, { recursive: true, force: true });
});

describe("getGlobalDataDir", () => {
  it("respects BRV_DATA_DIR override", () => {
    expect(getGlobalDataDir()).toBe(dataDir);
  });
});

describe("sanitizeProjectPath", () => {
  it("joins path components with '--'", () => {
    expect(sanitizeProjectPath("/Users/Phat/Desktop/byterover")).toBe(
      "Users--Phat--Desktop--byterover",
    );
  });

  it("percent-encodes literal '--' inside components to preserve injectivity", () => {
    expect(sanitizeProjectPath("/foo--bar")).toBe("foo%2D%2Dbar");
  });

  it("percent-encodes characters illegal on Windows", () => {
    expect(sanitizeProjectPath("/a/b:c?d")).toBe("a--b%3Ac%3Fd");
  });

  it("strips Windows drive colon (C:\\foo → C\\foo → C--foo)", () => {
    expect(sanitizeProjectPath("C:\\Users\\Phat")).toBe("C--Users--Phat");
  });

  it("truncates with sha256 suffix when length exceeds 200", () => {
    const longPath = "/" + "a".repeat(50) + "/" + "b".repeat(200);
    const sanitized = sanitizeProjectPath(longPath);
    expect(sanitized.length).toBeLessThanOrEqual(200);
    expect(sanitized).toContain("---"); // triple-dash separator
  });
});

describe("getProjectDataDir", () => {
  it("returns <BRV_DATA_DIR>/projects/<sanitized-canonical-cwd>", () => {
    const project = mkdtempSync(join(tmpdir(), "brv-proj-"));
    try {
      const canonical = realpathSync(project);
      const expected = join(dataDir, "projects", sanitizeProjectPath(canonical));
      expect(getProjectDataDir(project)).toBe(expected);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("includes the 'projects' segment", () => {
    const project = mkdtempSync(join(tmpdir(), "brv-proj-"));
    try {
      expect(getProjectDataDir(project).startsWith(join(dataDir, "projects") + sep)).toBe(true);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
