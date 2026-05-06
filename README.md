# @byterover/claude-plugin

Native plugin between [ByteRover](https://www.byterover.dev) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Enriches Claude's auto-memory with ByteRover's full multi-tier retrieval — BM25 search, importance scoring, performance correlation, and LLM synthesis — giving Claude persistent, cross-referenced context that improves over time.

## Table of contents

- [What it does](#what-it-does)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Commands](#commands)
- [How it works](#how-it-works)
- [Development](#development)
- [Project structure](#project-structure)
- [License](#license)

## What it does

Claude Code has a built-in auto-memory system — it saves observations across sessions as flat markdown files. ByteRover has a richer context tree with multi-tier retrieval: BM25 text search, importance/recency scoring, maturity tier boosting, performance-memory correlation, and LLM-powered synthesis. This plugin connects the two:

1. **Ingesting memories** — when Claude's extraction agent writes a memory file, a hook fires and sends the content to `brv curate`, which enriches it with tags, keywords, scoring metadata, and stores it in the context tree
2. **Syncing context** — after each turn, a hook queries ByteRover for ranked knowledge and writes a cross-reference file that Claude's recall system can pick up
3. **Visible activation** — every prompt that retrieves curated knowledge gets a one-line `🧠 ByteRover returns …` summary in the chat showing which memories were used. An opt-in status line at the bottom of Claude Code surfaces daemon activity (idle / curating / dreaming) so you can see when the context tree is being updated in the background
4. **Zero workflow change** — you use `claude` exactly as before. The plugin runs in the background via Claude Code's hook system

The result: Claude's memories are indexed, scored, and searchable alongside the rest of your project knowledge in ByteRover — and you can see the system working as you go.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- Node.js 20+
- [brv CLI](https://docs.byterover.dev/quickstart) installed and available on your `PATH`

## Quick start

### 1. Install the plugin

```bash
npm install -g @byterover/claude-plugin
```

### 2. Install hooks

```bash
brv-claude-plugin install
```

This adds four hooks to `~/.claude/settings.json`:

- **PostToolUse(Write)** — triggers `brv-claude-plugin ingest` when Claude writes a memory file
- **PostToolUse(Edit)** — triggers `brv-claude-plugin ingest` when Claude edits a memory file
- **Stop** — triggers `brv-claude-plugin sync` after each turn to refresh cross-references
- **UserPromptSubmit** — triggers `brv-claude-plugin recall` to query ByteRover with the user's prompt and inject relevant context before the model call

Your existing settings and hooks are preserved. A backup is saved to `settings.json.brv-backup`.

### 3. Install the status line (optional)

```bash
brv-claude-plugin install-statusline
```

Adds a `statusLine` entry to `~/.claude/settings.json` that renders one of three states at the bottom of Claude Code:

```
🧠 ByteRover · idle           (dim gray — no daemon work in progress)
🧠 ByteRover · 📝 curating    (yellow — a curate task is running)
🧠 ByteRover · 💭 dreaming    (cyan — a dream consolidation cycle is running)
```

The line is hidden when you're not in a brv-initialized project. Refreshes every 5 seconds in addition to Claude Code's event-driven triggers, so it picks up daemon state changes that happen while the assistant is mid-tool-call.

If you already have a custom `statusLine` configured, the installer prompts you (in a TTY) to keep it, replace it, or abort. Pass `--force` to overwrite without prompting; non-interactive shells fail-fast with a hint to use `--force`.

The status line is opt-in and removable via `brv-claude-plugin uninstall-statusline` (leaves foreign user statuslines alone) or as part of the full `brv-claude-plugin uninstall`.

### 4. Verify

```bash
brv-claude-plugin doctor
```

You should see all checks passing:

```
brv-claude-plugin doctor

  ✓ brv CLI — byterover-cli/3.10.3 darwin-arm64 node-v22.21.1
  ✓ Context tree — /path/to/project/.brv/context-tree
  ✓ Claude settings — ~/.claude/settings.json
  ✓ Bridge hooks — PostToolUse + Stop + UserPromptSubmit hooks found
  ✓ Bridge executable — /usr/local/bin/brv-claude-plugin
  ✓ Status line — registered, points to our binary
  ✓ Memory directory — ~/.claude/projects/-path-to-project/memory/

All checks passed.
```

The `Status line` check is informational — it shows ✓ when our status line is registered and ✗ otherwise (with a hint to run `install-statusline`), but a missing status line does not flip the overall outcome since it's opt-in.

### 5. Use Claude normally

```bash
claude "fix the auth bug"
```

Memories are ingested into `.brv/context-tree/` automatically. No changes to your workflow.

### 6. Uninstall (if needed)

```bash
brv-claude-plugin uninstall
```

Removes plugin hooks **and** our status line entry (if installed) in a single pass. Your other hooks, settings, and any foreign `statusLine` entry are untouched. To remove only the status line and keep the hooks, run `brv-claude-plugin uninstall-statusline` instead.

## Commands

### `brv-claude-plugin install`

Installs hooks into Claude Code's `~/.claude/settings.json`.

| Option              | Description                                |
| ------------------- | ------------------------------------------ |
| `--dry-run`         | Show what would be written without saving  |
| `--settings-path`   | Override path to Claude Code settings.json |

Idempotent — safe to run multiple times. Deduplicates by checking for the `#brv-claude-plugin` marker in existing hooks.

### `brv-claude-plugin uninstall`

Removes plugin hooks **and** the plugin's status line entry from settings. Per-hook removal — if a matcher entry contains both a plugin hook and your own hook, only the plugin hook is deleted. Foreign user `statusLine` entries are left intact.

| Option              | Description                                |
| ------------------- | ------------------------------------------ |
| `--settings-path`   | Override path to Claude Code settings.json |

### `brv-claude-plugin install-statusline`

Installs an opt-in `statusLine` entry into `~/.claude/settings.json` that surfaces daemon activity at the bottom of Claude Code. Idempotent. Backs up `settings.json` before writing.

If a `statusLine` is already configured:

- **Carries our `#brv-claude-plugin` marker:** idempotent — re-runs to upgrade fields if our shape has drifted (e.g., new `refreshInterval` value)
- **Foreign (someone else's):** prompts on TTY (keep / replace / abort, default abort); fails fast on non-TTY with instructions to use `--force`

| Option              | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `--dry-run`         | Show what would be written without saving                         |
| `--force`           | Overwrite an existing foreign statusLine without prompting        |
| `--settings-path`   | Override path to Claude Code settings.json                        |

### `brv-claude-plugin uninstall-statusline`

Removes only the plugin's `statusLine` entry. Marker-gated — leaves foreign user statuslines alone.

| Option              | Description                                |
| ------------------- | ------------------------------------------ |
| `--settings-path`   | Override path to Claude Code settings.json |

### `brv-claude-plugin status`

Called by the `statusLine` command in Claude Code's settings. Reads CC's status payload from stdin, walks up from the current directory to find `.brv/`, classifies daemon state via filesystem inspection, and prints one ANSI-colored line.

- Outputs nothing (line hidden) when no `.brv/` is reachable
- Inspects `.brv/dream-log/`, `.brv/dream.lock`, and the daemon's per-project storage directory under the platform's user-data dir for `curate-log/`
- Always exits 0; runs in well under 100ms in normal cases

### `brv-claude-plugin ingest`

Called by the PostToolUse hook. Reads hook JSON from stdin, parses the memory file, and sends it to `brv curate --detach`.

- **Write tool**: reads content from `tool_input.content`
- **Edit tool**: reads the file from disk (Edit only carries `old_string`/`new_string`)
- Skips non-memory files, `MEMORY.md`, and `_brv_context.md`
- Always exits 0 — never blocks Claude

| Option    | Description              |
| --------- | ------------------------ |
| `--json`  | Output result as JSON    |

### `brv-claude-plugin sync`

Called by the Stop hook. Copies the context tree index from `.brv/context-tree/_index.md` into `_brv_context.md` in Claude's memory directory with a single pointer in `MEMORY.md`.

- On success: writes context tree index with a guide note pointing to the full tree
- If `_index.md` unavailable but `_brv_context.md` exists: preserves existing content
- If `_index.md` unavailable and no existing file: writes a stub with "(sync pending)"
- Runs async in the background — never blocks Claude

| Option           | Description                              |
| ---------------- | ---------------------------------------- |
| `--json`         | Output result as JSON                    |
| `--memory-dir`   | Override path to Claude memory directory |

### `brv-claude-plugin recall`

Called by the UserPromptSubmit hook. Reads the user's prompt from stdin, queries ByteRover with it, and emits two things to Claude Code:

- **`additionalContext`** — the retrieved context wrapped in `<byterover-context>` tags, injected before the model call so the response can use it
- **`systemMessage`** — a one-line `🧠 ByteRover returns N memories: <path1> (3d ago), <path2> (1w ago), …` summary visible in the chat above Claude's response (capped at 3 paths, with humanized age suffixes)

Behavior:

- Runs **synchronously** — delays the model call until ByteRover responds (6s internal timeout, 8s hook timeout)
- Skips trivially short prompts (< 5 chars)
- Per-entry score filter (≥0.5) trims low-relevance hits from the visible summary; if no qualifying entries exist, the summary line is suppressed entirely
- On cache hits or older `brv` versions that don't return structured `matchedDocs`, falls back to regex-parsing the `**Sources**:` block at the end of the response prose
- If ByteRover query fails or times out, exits silently — prompt proceeds without context

### `brv-claude-plugin doctor`

Runs 7 diagnostic checks: brv CLI, context tree, settings file, installed hooks, plugin executable, status line registration, and memory directory resolution. The status line entry is informational — its absence does not flip the overall outcome since it's opt-in.

## How it works

The plugin uses Claude Code's [hook system](https://docs.anthropic.com/en/docs/claude-code/hooks) to intercept memory operations without modifying Claude Code's source.

### Recall flow (UserPromptSubmit hook)

```
User types: "fix the combo scoring bug"
  │
  ▼ UserPromptSubmit hook fires (before model call)
brv-claude-plugin recall
  │ brv query "fix the combo scoring bug" → targeted results
  ▼
  • Claude sees <byterover-context> as system reminder
    (live, relevant to this specific prompt)
  • A one-line `🧠 ByteRover returns N memories: <path>(3d ago), …`
    summary is shown in the chat above the response (capped at 3 paths)
```

The visible summary is built from the structured `matchedDocs` returned by `brv query --format json` when available; on cache hits or older `brv` versions the plugin falls back to parsing the `**Sources**:` block at the end of the response prose. Per-entry score filtering (≥0.5) keeps the line concise — if no qualifying entries exist, the line is suppressed entirely.

### Ingest flow (PostToolUse hook)

```
Claude writes ~/.claude/projects/.../memory/feedback_testing.md
  │
  ▼ PostToolUse hook fires, pipes JSON to stdin
brv-claude-plugin ingest
  │ Parse cc-ts frontmatter (name, description, type)
  │ Map type → domain (/user, /feedback, /project, /reference)
  ▼
brv curate --detach --format json -- "context string"
  │ Daemon queues curation (async, non-blocking)
  ▼
.brv/context-tree/feedback/testing.md
  (enriched with tags, keywords, importance scoring)
```

### Sync flow (Stop hook)

```
Turn ends
  │
  ▼ Stop hook fires
brv-claude-plugin sync
  │ read .brv/context-tree/_index.md → copy to memory dir
  ▼
~/.claude/projects/.../memory/_brv_context.md
  (context tree index + guide to full tree)
```

### Status line flow (statusLine entry)

The status line uses the same `statusLine` mechanism Claude Code documents — it runs the configured command after each assistant message, after `/compact`, on permission/vim-mode changes, AND every 5 seconds (`refreshInterval: 5`). The 5-second tick is what catches daemon state changes during long tool calls when no event-driven trigger fires.

```
Claude Code refresh tick (event or every 5s)
  │
  ▼ runs statusLine command (with stdin JSON payload)
brv-claude-plugin status
  │ Walk up from cwd → find `.brv/`
  │   (none → empty stdout → line hidden)
  │ Inspect filesystem signals:
  │   • <brvDir>/dream-log/*.json (project-local)
  │   • <brvDir>/dream.lock        (project-local)
  │   • <getProjectDataDir(cwd)>/curate-log/*.json
  │     (per-project storage under the OS user-data dir —
  │      mirrors the daemon's path resolution)
  ▼
Print one ANSI-colored line:
  🧠 ByteRover · idle / 📝 curating / 💭 dreaming
```

State classification follows a confident-signals-first order: an active `dream-log` entry wins; an active `curate-log` entry wins over the `dream.lock` fallback; the lock alone is honored only if it's fresh (within 15 minutes) and the latest `dream-log` entry isn't already marked `completed`. This combination catches stale locks left behind by interrupted daemons and avoids masking active curate work. A residual edge case remains for daemons that crash mid-dream within the 15-minute window — the proper fix lives daemon-side and is tracked separately.

### Memory path resolution

The plugin resolves Claude's memory directory using the same logic as Claude Code:

1. `CLAUDE_COWORK_MEMORY_PATH_OVERRIDE` env var (full override)
2. `autoMemoryDirectory` from settings (local → user, excluding project settings for security)
3. `~/.claude/projects/<sanitized-canonical-git-root>/memory/`

Git worktrees are resolved to their canonical root so all worktrees share one memory directory.

### Multi-project support

The plugin naturally supports multiple projects. Claude Code scopes memory per git repository, and ByteRover scopes its context tree per `.brv/` directory. Both use the same `cwd` from the hook input as their anchor:

```
/Users/x/project-a/        ← claude session here
├── .git/                   ← Claude memory: ~/.claude/projects/-Users-x-project-a/memory/
├── .brv/                   ← ByteRover tree: project-a/.brv/context-tree/
└── src/

/Users/x/project-b/        ← separate claude session here
├── .git/                   ← Claude memory: ~/.claude/projects/-Users-x-project-b/memory/
├── .brv/                   ← ByteRover tree: project-b/.brv/context-tree/
└── src/
```

Each project's memories are ingested into its own context tree and synced back to its own memory directory. No cross-project leakage.

**Important: initialize `.brv/` at the git root.** Claude Code resolves memory directories from the canonical git root. ByteRover walks up from `cwd` to find `.brv/`. When both are at the same level, everything maps correctly.

If you initialize `.brv/` in a subdirectory instead of the git root, the plugin will encounter mismatches:

```
/monorepo/                  ← git root (Claude memory lives here)
├── .git/
├── frontend/
│   └── .brv/               ← brv initialized here, not at git root
└── backend/                ← sessions from here won't find .brv/
```

In this layout, Claude sessions from `/monorepo/backend/` would fail to reach the `.brv/` in `frontend/`. To fix this, initialize ByteRover at the git root:

```bash
cd /monorepo
brv init                    # .brv/ at git root — matches Claude's project boundary
```

If you need separate context trees for subdirectories in a monorepo, initialize `.brv/` in each subdirectory and run `claude` from within that subdirectory (not from the monorepo root).

### Hook identification

Every stored hook command includes a `#brv-claude-plugin` shell comment marker. This marker — not the path text — is used by `install` (dedupe), `uninstall` (removal), and `doctor` (detection). A clone in any directory will work correctly.

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run build

# Run in dev mode
npm run dev -- doctor

# Run built CLI
node dist/cli.js doctor
```

### Testing locally

1. Initialize a brv project: `cd /your/project && brv init`
2. Build the plugin: `npm run build`
3. Install hooks (dev mode): `node dist/cli.js install`
4. Start a Claude session and make a few changes
5. Check `.brv/context-tree/` for ingested memories
6. Check `~/.claude/projects/.../memory/_brv_context.md` for synced context

## Project structure

```
src/
  cli.ts                      # Commander.js entry point
  cc-frontmatter.ts           # Claude Code memory YAML frontmatter parser
  memory-path.ts              # Full cc-ts memory path resolution (git root, worktrees, env vars)
  stdin.ts                    # Read + validate JSON from stdin
  bridge-command.ts           # Executable resolution + #brv-claude-plugin marker
  build-recall-output.ts      # Recall orchestrator — combines query result, score filter, fallback
  build-visible-summary.ts    # Recall preamble formatter — `🧠 ByteRover returns N memories…` line
  parse-sources.ts            # Regex fallback over **Sources**: blocks for cache-hit recovery
  resolve-context-tree-age.ts # Frontmatter-based age resolution (updatedAt → mtime → undefined)
  state-detector.ts           # Filesystem state classification for the status line
  format-status-line.ts       # ANSI-colored status line formatter (idle / curating / dreaming)
  project-data-dir.ts         # Mirrors daemon's getGlobalDataDir + sanitizeProjectPath
  schemas/
    cc-hook-input.ts          # Zod schemas for PostToolUse and Stop hook input
    cc-settings.ts            # Raw JSON read/write for settings.json (lossless)
  commands/
    install.ts                # Install hooks into settings.json (per-hook dedupe, backup)
    uninstall.ts              # Remove plugin hooks AND status line (per-hook removal)
    install-statusline.ts     # Opt-in statusLine installer (prompt / --force / upgrade-in-place)
    uninstall-statusline.ts   # Marker-gated statusLine removal
    ingest.ts                 # PostToolUse handler — Write/Edit split, brv curate
    sync.ts                   # Stop handler — _index.md copy, _brv_context.md, MEMORY.md pointer
    recall.ts                 # UserPromptSubmit handler — live brv query, visible summary
    status.ts                 # statusLine handler — daemon state classification → one-line output
    doctor.ts                 # 7 diagnostic checks (incl. status line registration)
```

## License

[Elastic License 2.0 (ELv2)](./LICENSE)
