import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveContextTreeAge } from "../src/resolve-context-tree-age.js";

describe("resolveContextTreeAge", () => {
  let projectRoot: string;
  let contextTreeDir: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "brv-resolve-age-"));
    contextTreeDir = join(projectRoot, ".brv", "context-tree");
    mkdirSync(contextTreeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("returns frontmatter.updatedAt when present (standard topic file)", () => {
    writeFileSync(
      join(contextTreeDir, "standard.md"),
      `---
title: Standard
createdAt: '2026-01-01T00:00:00Z'
updatedAt: '2026-04-15T12:30:00Z'
---

body`,
    );

    const age = resolveContextTreeAge(projectRoot, "standard.md");
    expect(age?.toISOString()).toBe("2026-04-15T12:30:00.000Z");
  });

  it("returns frontmatter.synthesized_at for synthesis files (no updatedAt)", () => {
    writeFileSync(
      join(contextTreeDir, "synth.md"),
      `---
type: synthesis
confidence: 1
synthesized_at: '2026-04-24T09:35:50.119Z'
---

body`,
    );

    const age = resolveContextTreeAge(projectRoot, "synth.md");
    expect(age?.toISOString()).toBe("2026-04-24T09:35:50.119Z");
  });

  it("falls back to createdAt when updatedAt and synthesized_at are absent", () => {
    writeFileSync(
      join(contextTreeDir, "created-only.md"),
      `---
title: Old
createdAt: '2026-02-10T00:00:00Z'
---

body`,
    );

    const age = resolveContextTreeAge(projectRoot, "created-only.md");
    expect(age?.toISOString()).toBe("2026-02-10T00:00:00.000Z");
  });

  it("falls back to file mtime when frontmatter has no timestamp keys", () => {
    const path = join(contextTreeDir, "no-timestamps.md");
    writeFileSync(
      path,
      `---
children_hash: abc
summary_level: d2
---

body`,
    );
    // Pin mtime to a known value so the assertion is deterministic.
    const pinned = new Date("2026-03-15T08:00:00Z");
    utimesSync(path, pinned, pinned);

    const age = resolveContextTreeAge(projectRoot, "no-timestamps.md");
    expect(age?.toISOString()).toBe("2026-03-15T08:00:00.000Z");
  });

  it("falls back to file mtime for files with no frontmatter at all", () => {
    const path = join(contextTreeDir, "context.md");
    writeFileSync(path, `# Domain: design\n\nNo frontmatter here.\n`);
    const pinned = new Date("2026-03-20T08:00:00Z");
    utimesSync(path, pinned, pinned);

    const age = resolveContextTreeAge(projectRoot, "context.md");
    expect(age?.toISOString()).toBe("2026-03-20T08:00:00.000Z");
  });

  it("returns undefined when the file does not exist", () => {
    const age = resolveContextTreeAge(projectRoot, "missing.md");
    expect(age).toBeUndefined();
  });

  it("returns undefined for shared-source [alias]:path entries (path is in another project)", () => {
    const age = resolveContextTreeAge(projectRoot, "[shared-design]:auth/sso.md");
    expect(age).toBeUndefined();
  });

  it("falls back to mtime when frontmatter is malformed YAML", () => {
    const path = join(contextTreeDir, "broken.md");
    writeFileSync(
      path,
      `---
this is not: { valid: yaml
broken
---

body`,
    );
    const pinned = new Date("2026-03-25T08:00:00Z");
    utimesSync(path, pinned, pinned);

    const age = resolveContextTreeAge(projectRoot, "broken.md");
    expect(age?.toISOString()).toBe("2026-03-25T08:00:00.000Z");
  });
});
