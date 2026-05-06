import { describe, it, expect } from "vitest";
import { formatStatusLine } from "../src/format-status-line.js";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BRAND = "🧠 ByteRover · ";

describe("formatStatusLine", () => {
  it("renders idle in dim gray with the brand prefix neutral", () => {
    expect(formatStatusLine("idle")).toBe(BRAND + DIM + "idle" + RESET);
  });

  it("renders curating in yellow with the notebook icon", () => {
    expect(formatStatusLine("curating")).toBe(
      BRAND + YELLOW + "📝 curating" + RESET,
    );
  });

  it("renders dreaming in cyan with the thought-bubble icon", () => {
    expect(formatStatusLine("dreaming")).toBe(
      BRAND + CYAN + "💭 dreaming" + RESET,
    );
  });

  it("keeps the brand prefix unstyled (no ANSI codes before the separator)", () => {
    for (const state of ["idle", "curating", "dreaming"] as const) {
      expect(formatStatusLine(state).startsWith(BRAND)).toBe(true);
    }
  });
});
