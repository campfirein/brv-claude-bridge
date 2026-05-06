import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  utimesSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { findBrvDir, detectState } from "../src/state-detector.js";
import { sanitizeProjectPath } from "../src/project-data-dir.js";

let root: string;
let dataDir: string;
let prevDataEnv: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "brv-statedetect-"));
  dataDir = mkdtempSync(join(tmpdir(), "brv-data-"));
  prevDataEnv = process.env.BRV_DATA_DIR;
  process.env.BRV_DATA_DIR = dataDir;
});

afterEach(() => {
  if (prevDataEnv === undefined) {
    delete process.env.BRV_DATA_DIR;
  } else {
    process.env.BRV_DATA_DIR = prevDataEnv;
  }
  rmSync(root, { recursive: true, force: true });
  rmSync(dataDir, { recursive: true, force: true });
});

function makeBrv(dir: string): string {
  const brvDir = join(dir, ".brv");
  mkdirSync(brvDir, { recursive: true });
  return brvDir;
}

function writeProjectLocalLog(
  brvDir: string,
  kind: "dream-log",
  filename: string,
  payload: Record<string, unknown>,
): void {
  const logDir = join(brvDir, kind);
  mkdirSync(logDir, { recursive: true });
  writeFileSync(join(logDir, filename), JSON.stringify(payload), "utf8");
}

/**
 * Curate-log lives at <BRV_DATA_DIR>/projects/<sanitized-canonical-cwd>/curate-log/,
 * not under the project-local `.brv/`. Helper writes one entry there.
 */
function writeCurateLog(
  cwd: string,
  filename: string,
  payload: Record<string, unknown>,
): void {
  const sanitized = sanitizeProjectPath(realpathSync(cwd));
  const logDir = join(dataDir, "projects", sanitized, "curate-log");
  mkdirSync(logDir, { recursive: true });
  writeFileSync(join(logDir, filename), JSON.stringify(payload), "utf8");
}

describe("findBrvDir", () => {
  it("returns the .brv path when cwd is the project root", () => {
    const brvDir = makeBrv(root);
    expect(findBrvDir(root)).toBe(brvDir);
  });

  it("walks up to find .brv when cwd is a subdirectory", () => {
    const brvDir = makeBrv(root);
    const sub = join(root, "src", "deep", "nested");
    mkdirSync(sub, { recursive: true });
    expect(findBrvDir(sub)).toBe(brvDir);
  });

  it("returns undefined when no .brv exists from cwd up", () => {
    expect(findBrvDir(root)).toBeUndefined();
  });

  it("returns the closest .brv when nested projects exist", () => {
    makeBrv(root);
    const innerProject = join(root, "packages", "inner");
    const innerBrv = makeBrv(innerProject);
    expect(findBrvDir(innerProject)).toBe(innerBrv);
  });
});

describe("detectState — dream", () => {
  it("returns 'dreaming' when dream.lock exists and no dream-log entries are present", () => {
    const brvDir = makeBrv(root);
    writeFileSync(join(brvDir, "dream.lock"), "{}", "utf8");
    expect(detectState(brvDir, root)).toBe("dreaming");
  });

  it("returns 'dreaming' when latest dream-log entry has status 'processing' (lock absent)", () => {
    const brvDir = makeBrv(root);
    writeProjectLocalLog(brvDir, "dream-log", "drm-100.json", { status: "completed" });
    writeProjectLocalLog(brvDir, "dream-log", "drm-200.json", { status: "processing" });
    expect(detectState(brvDir, root)).toBe("dreaming");
  });

  it("returns 'dreaming' when both lock and latest dream-log 'processing' agree", () => {
    const brvDir = makeBrv(root);
    writeFileSync(join(brvDir, "dream.lock"), "{}", "utf8");
    writeProjectLocalLog(brvDir, "dream-log", "drm-200.json", { status: "processing" });
    expect(detectState(brvDir, root)).toBe("dreaming");
  });

  it("returns 'idle' when lock exists but latest dream-log shows completed (stale lock)", () => {
    const brvDir = makeBrv(root);
    writeFileSync(join(brvDir, "dream.lock"), "{}", "utf8");
    writeProjectLocalLog(brvDir, "dream-log", "drm-200.json", { status: "completed" });
    expect(detectState(brvDir, root)).toBe("idle");
  });

  it("returns 'idle' when no lock and latest dream-log is completed", () => {
    const brvDir = makeBrv(root);
    writeProjectLocalLog(brvDir, "dream-log", "drm-100.json", { status: "processing" });
    writeProjectLocalLog(brvDir, "dream-log", "drm-200.json", { status: "completed" });
    expect(detectState(brvDir, root)).toBe("idle");
  });

  it("uses lexicographic filename order for 'most recent' (not mtime)", () => {
    const brvDir = makeBrv(root);
    writeProjectLocalLog(brvDir, "dream-log", "drm-200.json", { status: "processing" });
    writeProjectLocalLog(brvDir, "dream-log", "drm-300.json", { status: "completed" });
    expect(detectState(brvDir, root)).toBe("idle");
  });

  it("treats malformed JSON in latest dream-log as not-processing", () => {
    const brvDir = makeBrv(root);
    const logDir = join(brvDir, "dream-log");
    mkdirSync(logDir);
    writeFileSync(join(logDir, "drm-200.json"), "{not json", "utf8");
    expect(detectState(brvDir, root)).toBe("idle");
  });
});

describe("detectState — curate (under project data dir)", () => {
  it("returns 'curating' when latest curate-log entry has status 'processing'", () => {
    const brvDir = makeBrv(root);
    writeCurateLog(root, "cur-200.json", { status: "processing" });
    expect(detectState(brvDir, root)).toBe("curating");
  });

  it("returns 'idle' when latest curate-log entry is completed", () => {
    const brvDir = makeBrv(root);
    writeCurateLog(root, "cur-100.json", { status: "processing" });
    writeCurateLog(root, "cur-200.json", { status: "completed" });
    expect(detectState(brvDir, root)).toBe("idle");
  });

  it("returns 'idle' when curate-log directory does not exist", () => {
    const brvDir = makeBrv(root);
    expect(detectState(brvDir, root)).toBe("idle");
  });
});

describe("detectState — precedence", () => {
  it("dream wins when both dream-log and curate-log are processing", () => {
    const brvDir = makeBrv(root);
    writeProjectLocalLog(brvDir, "dream-log", "drm-200.json", { status: "processing" });
    writeCurateLog(root, "cur-200.json", { status: "processing" });
    expect(detectState(brvDir, root)).toBe("dreaming");
  });

  it("active curate wins over a stale dream.lock with no contradicting log", () => {
    const brvDir = makeBrv(root);
    writeFileSync(join(brvDir, "dream.lock"), "{}", "utf8");
    writeCurateLog(root, "cur-200.json", { status: "processing" });
    expect(detectState(brvDir, root)).toBe("curating");
  });
});

describe("detectState — stale-lock mtime threshold", () => {
  it("returns 'dreaming' for a fresh dream.lock (mtime within threshold)", () => {
    const brvDir = makeBrv(root);
    writeFileSync(join(brvDir, "dream.lock"), "{}", "utf8");
    expect(detectState(brvDir, root)).toBe("dreaming");
  });

  it("returns 'idle' for a stale dream.lock older than the 15-min threshold", () => {
    const brvDir = makeBrv(root);
    const lockPath = join(brvDir, "dream.lock");
    writeFileSync(lockPath, "{}", "utf8");
    // Backdate mtime/atime to 16 minutes ago.
    const sixteenMinAgo = (Date.now() - 16 * 60 * 1000) / 1000;
    utimesSync(lockPath, sixteenMinAgo, sixteenMinAgo);
    expect(detectState(brvDir, root)).toBe("idle");
  });

  it("active curate still wins over a stale (fresh) lock — both fixes compose", () => {
    const brvDir = makeBrv(root);
    writeFileSync(join(brvDir, "dream.lock"), "{}", "utf8");
    writeCurateLog(root, "cur-200.json", { status: "processing" });
    expect(detectState(brvDir, root)).toBe("curating");
  });
});
