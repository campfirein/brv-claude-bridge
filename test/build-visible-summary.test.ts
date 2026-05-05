import { describe, it, expect } from "vitest";
import {
  buildVisibleSummary,
  type VisibleSummaryEntry,
} from "../src/build-visible-summary.js";

const NOW = new Date("2026-05-04T12:00:00Z");

function entry(
  path: string,
  daysAgo: number | undefined,
): VisibleSummaryEntry {
  if (daysAgo === undefined) return { path };
  const age = new Date(NOW.getTime() - daysAgo * 86_400_000);
  return { path, age };
}

describe("buildVisibleSummary", () => {
  it("returns empty string when given no entries", () => {
    expect(buildVisibleSummary([], { now: NOW })).toBe("");
  });

  it("renders one entry with singular memory noun", () => {
    const out = buildVisibleSummary(
      [entry("auth/jwt-tokens.md", 3)],
      { now: NOW },
    );
    expect(out).toBe("🧠 ByteRover returns 1 memory: auth/jwt-tokens.md (3d ago)");
  });

  it("renders three entries with plural memory noun and humanized ages", () => {
    const out = buildVisibleSummary(
      [
        entry("auth/jwt-tokens.md", 3),
        entry("billing/stripe-webhooks.md", 7),
        entry("design/caching.md", 30),
      ],
      { now: NOW },
    );
    expect(out).toBe(
      "🧠 ByteRover returns 3 memories: auth/jwt-tokens.md (3d ago), billing/stripe-webhooks.md (1w ago), design/caching.md (1mo ago)",
    );
  });

  it("caps at three entries and reports 3 in the count to match what is shown", () => {
    const out = buildVisibleSummary(
      [
        entry("a.md", 1),
        entry("b.md", 2),
        entry("c.md", 3),
        entry("d.md", 4),
        entry("e.md", 5),
      ],
      { now: NOW },
    );
    expect(out).toBe(
      "🧠 ByteRover returns 3 memories: a.md (1d ago), b.md (2d ago), c.md (3d ago)",
    );
  });

  it("omits the age suffix when age is undefined", () => {
    const out = buildVisibleSummary(
      [
        entry("auth/jwt-tokens.md", 3),
        { path: "design/caching.md" }, // no age
      ],
      { now: NOW },
    );
    expect(out).toBe(
      "🧠 ByteRover returns 2 memories: auth/jwt-tokens.md (3d ago), design/caching.md",
    );
  });

  it("renders age <1d as 'today'", () => {
    const out = buildVisibleSummary(
      [
        {
          path: "fresh.md",
          age: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
        },
      ],
      { now: NOW },
    );
    expect(out).toBe("🧠 ByteRover returns 1 memory: fresh.md (today)");
  });

  it("renders ages crossing month boundaries", () => {
    const out = buildVisibleSummary(
      [
        entry("yearly.md", 365),
        entry("quarter.md", 95),
        entry("week.md", 14),
      ],
      { now: NOW },
    );
    expect(out).toBe(
      "🧠 ByteRover returns 3 memories: yearly.md (1y ago), quarter.md (3mo ago), week.md (2w ago)",
    );
  });

  it("preserves [alias]:path format for shared cross-project sources", () => {
    const out = buildVisibleSummary(
      [
        { path: "[shared-design]:auth/sso.md", age: new Date(NOW.getTime() - 86_400_000) },
        entry("local/notes.md", 2),
      ],
      { now: NOW },
    );
    expect(out).toBe(
      "🧠 ByteRover returns 2 memories: [shared-design]:auth/sso.md (1d ago), local/notes.md (2d ago)",
    );
  });

  it("treats future-dated ages defensively as undefined", () => {
    const out = buildVisibleSummary(
      [
        {
          path: "clock-skew.md",
          age: new Date(NOW.getTime() + 5 * 86_400_000),
        },
      ],
      { now: NOW },
    );
    expect(out).toBe("🧠 ByteRover returns 1 memory: clock-skew.md");
  });
});
