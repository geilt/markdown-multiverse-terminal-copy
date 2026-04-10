# Markdown Multiverse — Terminal Copy Tool

## Context

Terminal output pasted into docs, issues, chat, or AI tools is usually ugly: ANSI color codes, carriage-return overwrites from spinners/progress bars, trailing whitespace, backspace overprinting from man pages, box-drawing tables, and soft-wrapped prose.

The web tool at [missionsystems.co.uk/tools/terminal-text-fixer.html](https://www.missionsystems.co.uk/tools/terminal-text-fixer.html) solves the cleanup problem. This project ports that pipeline into VS Code **and** extends it: instead of just one cleaned variant, the extension offers a submenu of destination-aware formats (Markdown, Slack, Discord, Telegram, HTML), each of which wraps the cleaned text appropriately for where it's going.

Published open source at [github.com/geilt/markdown-multiverse-terminal-copy](https://github.com/geilt/markdown-multiverse-terminal-copy) and on the VS Code Marketplace.

## Phased scope

- **v1 (0.0.1)** — validate the core flow: right-click → clean copy to clipboard. One command, one pipeline. ✅
- **v2 (0.1.0)** — `Copy As` submenu with 6 format variants (Clean, Markdown, Slack, Discord, Telegram, HTML) plus content classification (table / diff / prose / code). ✅
- **v3** — LLM/chat piping: Copy as Prompt, Send to LLM, target-specific copy (GitHub Issue, Jira, ChatGPT, Claude). See **Future roadmap** below.

## Feasibility: how we read terminal selections

VS Code's stable API does **not** expose terminal selection text directly (tracking issue [microsoft/vscode#188173](https://github.com/microsoft/vscode/issues/188173)). The marketplace-safe workaround:

1. User right-clicks a terminal selection → picks a command from the **Copy As** submenu.
2. Extension snapshots the current clipboard (`before`).
3. Extension runs the built-in command `workbench.action.terminal.copySelection`.
4. Extension reads `vscode.env.clipboard.readText()` (`raw`).
5. If `raw === before`, nothing was selected — bail with a status message, clipboard untouched.
6. Otherwise, run `raw` through `clean()`, then through the selected format, then write the result back with `vscode.env.clipboard.writeText()`.
7. Show a brief status-bar message naming the chosen format.

This uses only stable API. Menu registration uses the `terminal/context` contribution point with a nested `contributes.submenus` entry named `markdownMultiverse.copyAs`.

## Architecture

```
raw terminal selection
        │
        ▼
    clean(raw)           ← src/clean.ts — pure pipeline (no vscode deps)
        │
        ▼
    detect(cleaned)      ← src/detect.ts — classifier
        │
        ▼
    format(cleaned)      ← src/formats/{plain,markdown,slack,discord,telegram,html}.ts
        │
        ▼
  clipboard.writeText
```

`clean.ts` and `detect.ts` have **zero VS Code imports** so they are trivially testable (pure `node --test`) and reusable by future v3 features (prompt wrapping, LLM calls, history).

## The cleanup pipeline (`src/clean.ts`)

Each step is a pure `(string) => string` composed in order:

1. `stripAnsi` — SGR color/style codes, cursor movement, OSC title sequences, bracketed paste markers.
2. `resolveCarriageReturns` — simulate `\r` overwrite so progress bars and spinners collapse to their final state.
3. `resolveBackspaces` — walk characters; `\b` deletes the previous char (resolves man-page bold/underline overprinting).
4. `stripQuoteMarkers` — remove the `▎` U+258E block-quote character Claude inserts in quoted responses.
5. `normalizeTabs` — replace `\t` with N spaces (default 4).
6. `stripTrailingWhitespace` — per-line trim.
7. `stripPrompts` *(optional)* — remove common shell prompts. Off by default.
8. `dedentCommon` — strip the largest common leading-whitespace prefix if the majority of lines share it.
9. `convertBoxTables` — detect Unicode box-drawing blocks and convert them into Markdown pipe tables.
10. `reflowParagraphs` — rejoin soft-wrapped prose while preserving diffs, code, gutter-numbered output, lists, headings, and table rows.
11. Collapse runs of 3+ blank lines to 2, then `trimEnd()`.

## The classifier (`src/detect.ts`)

```ts
export type ContentKind = 'table' | 'diff' | 'code' | 'prose';
export function detect(text: string): { kind: ContentKind };
```

Detection order:

1. **Table** — every non-blank line matches `^\s*\|.*\|\s*$` AND at least one line is a separator (`| --- |`).
2. **Diff** — contains a unified-diff hunk header (`@@ -X,Y +X,Y @@`), or 2+ lines start with `+ ` / `- ` and they're ≥50% of the content.
3. **Prose** — 2+ lines, >50% of lines start with a capital letter and end with `.`, `!`, or `?`.
4. **Code** — default (almost all terminal output).

The thresholds are tuned so `ls -la` (which has many `-rw-r--r--` lines) classifies as **code**, not **diff**.

## The formats (`src/formats/*.ts`)

Each format is a pure `(cleaned: string) => string` function. They dispatch on `detect(cleaned).kind`:

| Format | Table | Diff | Code | Prose |
|--------|-------|------|------|-------|
| **plain** | passthrough | passthrough | passthrough | passthrough |
| **markdown** | passthrough (already a pipe table) | ``` fence | ``` fence | passthrough |
| **slack** | ``` fence | ``` fence | ``` fence | ``` fence |
| **discord** | ``` fence | ```diff fence | ``` fence | ``` fence |
| **telegram** | ``` fence + escape | ``` fence + escape | ``` fence + escape | ``` fence + escape |
| **html** | `<table>` | `<pre><code>` | `<pre><code>` | `<p>` |

Details:

- **markdown** bumps to ```` when the cleaned content already contains ``` to avoid premature fence closure.
- **slack** always fences — Slack's `mrkdwn` doesn't support tables at all, so the best rendering for tabular terminal output is a monospace code block.
- **discord** adds a `diff` language hint when the classifier sees diff content (Discord renders diff syntax with colors).
- **telegram** uses MarkdownV2 fenced code blocks. Inside a fence, only ``` and `\` need escaping — reserved prose chars don't apply inside code.
- **html** entity-escapes `& < > " '`. For tables, parses Markdown pipe rows and emits `<table><thead><tr><th>` / `<tbody><tr><td>`. For prose, splits on blank lines and wraps each block in `<p>`.

## Commands, submenu, and settings

### Commands

| Command | Title |
|---------|-------|
| `markdownMultiverse.copyClean` | Markdown Multiverse: Copy as Clean |
| `markdownMultiverse.copyMarkdown` | Markdown Multiverse: Copy as Markdown |
| `markdownMultiverse.copySlack` | Markdown Multiverse: Copy as Slack |
| `markdownMultiverse.copyDiscord` | Markdown Multiverse: Copy as Discord |
| `markdownMultiverse.copyTelegram` | Markdown Multiverse: Copy as Telegram |
| `markdownMultiverse.copyHtml` | Markdown Multiverse: Copy as HTML |

### Menu wiring

```jsonc
{
  "submenus": [
    { "id": "markdownMultiverse.copyAs", "label": "Copy As" }
  ],
  "menus": {
    "terminal/context": [
      { "submenu": "markdownMultiverse.copyAs", "group": "3_edit@10" }
    ],
    "markdownMultiverse.copyAs": [
      { "command": "markdownMultiverse.copyClean",    "group": "1_formats@1" },
      { "command": "markdownMultiverse.copyMarkdown", "group": "1_formats@2" },
      { "command": "markdownMultiverse.copySlack",    "group": "1_formats@3" },
      { "command": "markdownMultiverse.copyDiscord",  "group": "1_formats@4" },
      { "command": "markdownMultiverse.copyTelegram", "group": "1_formats@5" },
      { "command": "markdownMultiverse.copyHtml",     "group": "1_formats@6" }
    ]
  }
}
```

### Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `markdownMultiverse.stripPrompts` | boolean | `false` | Strip common shell prompt prefixes. Destructive. |
| `markdownMultiverse.tabWidth` | number | `4` | Spaces per tab. |

## Future roadmap (v3+)

### 1. Copy as Prompt

Wrap cleaned output in a user-defined prompt template. Settings key: `markdownMultiverse.promptTemplates` — array of named templates using `{{cleaned}}` as the placeholder. Templates appear in the Copy As submenu under a `2_prompts` group.

### 2. Send to LLM

Post the cleaned (optionally prompt-wrapped) text directly to a configured endpoint. MVP targets:

- Anthropic Messages API (`claude-opus-4-6`, `claude-sonnet-4-6`)
- OpenAI Chat Completions
- Local Ollama (`http://localhost:11434`)

API keys stored via VS Code `SecretStorage`, never in `settings.json`. Response opens in a new untitled Markdown editor or a side webview.

### 3. More target-specific formats

- **GitHub Issue** — wraps in `<details><summary>Terminal output</summary>` collapsible blocks.
- **Jira** — Atlassian wiki markup (`{code}...{code}`).
- **ChatGPT / Claude / Gemini** — tuned preambles.

### 4. Pipe through external command

`Copy through…` opens a QuickPick of user-configured shell commands (e.g. `jq`, `glow`) and pipes cleaned text through the chosen one. Uses `execFile`-style arg arrays, never shell string concat.

### 5. Save to file

`Copy Clean to New File` opens the cleaned text in a new untitled editor instead of the clipboard.

### 6. History

Last N cleaned copies stored in `globalState`, surfaced via `Markdown Multiverse: Show History` (QuickPick).

## Verification

### Unit tests

Tests live in `src/test/*.test.ts` and run with `node --test`. 44 tests covering `clean`, `detect`, and every formatter.

```sh
npm test
```

### End-to-end manual test

Press <kbd>F5</kbd> in VS Code to launch the Extension Development Host.

1. Open a terminal. Run `ls --color=always -la`.
2. Select several lines. Right-click → **Copy As → Markdown**. Paste — expect a ``` ``` ``` fenced block with no ANSI.
3. Right-click → **Copy As → HTML**. Paste into an HTML file — expect `<pre><code>` with entity-escaped content.
4. Generate a table: `printf '\u250C\u2500\u2510\n\u2502 a \u2502\n\u2514\u2500\u2518\n'` (or use any command that produces box-drawing output). Select it. Right-click → **Copy As → HTML** — expect `<table>`.
5. Run `git diff HEAD~1` in a repo. Select hunks. Right-click → **Copy As → Discord** — expect ```` ```diff ```` fence.
6. Select nothing. Click any Copy As item. Expect: "no terminal selection" status message, clipboard untouched.

### Marketplace packaging smoke test

```sh
npx @vscode/vsce package
code --install-extension markdown-multiverse-terminal-copy-0.1.0.vsix
```
