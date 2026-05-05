import { describe, it, expect } from "vitest";
import { parseSourcesFromContent } from "../src/parse-sources.js";

describe("parseSourcesFromContent", () => {
  it("extracts paths from a standard **Sources**: block", () => {
    const content = `**Summary**: foo bar baz.

**Details**:
some details here.

**Sources**:
- \`.brv/context-tree/auth/jwt-tokens.md\`
- \`.brv/context-tree/billing/stripe-webhooks.md\`

**Gaps**: nothing notable.`;

    expect(parseSourcesFromContent(content)).toEqual([
      "auth/jwt-tokens.md",
      "billing/stripe-webhooks.md",
    ]);
  });

  it("strips the .brv/context-tree/ prefix when present", () => {
    const content = `**Sources**:\n- \`.brv/context-tree/design/caching.md\``;
    expect(parseSourcesFromContent(content)).toEqual(["design/caching.md"]);
  });

  it("preserves [alias]:path format for shared cross-project sources", () => {
    const content = `**Sources**:\n- \`[shared-design]:auth/sso.md\`\n- \`.brv/context-tree/local/notes.md\``;
    expect(parseSourcesFromContent(content)).toEqual([
      "[shared-design]:auth/sso.md",
      "local/notes.md",
    ]);
  });

  it("returns empty array when **Sources**: is None (Tier 2 not-found)", () => {
    const content = `**Summary**: No matching knowledge found.\n\n**Sources**: None\n\n**Gaps**: …`;
    expect(parseSourcesFromContent(content)).toEqual([]);
  });

  it("returns empty array when there is no Sources block at all", () => {
    expect(parseSourcesFromContent("just plain prose with no sources")).toEqual([]);
  });

  it("returns empty array on empty input", () => {
    expect(parseSourcesFromContent("")).toEqual([]);
  });

  it("handles whitespace and blank lines between Sources header and list", () => {
    const content = `**Sources**:\n\n   - \`a.md\`\n   - \`b.md\``;
    expect(parseSourcesFromContent(content)).toEqual(["a.md", "b.md"]);
  });

  it("stops at the next markdown heading (Gaps, Details, etc.)", () => {
    const content = `**Sources**:\n- \`a.md\`\n- \`b.md\`\n\n**Gaps**: this should not be parsed as a source\n- \`should-not-appear.md\``;
    expect(parseSourcesFromContent(content)).toEqual(["a.md", "b.md"]);
  });
});
