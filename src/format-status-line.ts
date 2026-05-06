import type { BrvState } from "./state-detector.js";

// ANSI escape sequences scoped to the state suffix only — the
// `🧠 ByteRover · ` brand prefix stays neutral. Raw escape codes (no
// picocolors) because picocolors disables colors on non-TTY stdout, but
// Claude Code reads our stdout from a piped context and renders the ANSI
// in its own TTY panel.
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

const BRAND_PREFIX = "🧠 ByteRover · ";

export function formatStatusLine(state: BrvState): string {
  switch (state) {
    case "idle":
      return BRAND_PREFIX + DIM + "idle" + RESET;
    case "curating":
      return BRAND_PREFIX + YELLOW + "📝 curating" + RESET;
    case "dreaming":
      return BRAND_PREFIX + CYAN + "💭 dreaming" + RESET;
  }
}
