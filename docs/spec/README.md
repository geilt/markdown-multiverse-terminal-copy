# Markdown Multiverse — Design Specification

## Context

Terminal output pasted into docs, issues, chat, or AI tools is usually ugly: ANSI color codes, carriage-return overwrites from spinners/progress bars, trailing whitespace, backspace overprinting from man pages, box-drawing tables, and soft-wrapped prose. Markdown pasted into chat apps loses formatting because each app has its own flavor — Slack uses `*bold*`, Discord uses `**bold**`, Telegram uses MarkdownV2 escaping, and none of them agree on tables.

The web tool at [missionsystems.co.uk/tools/terminal-text-fixer.html](https://www.missionsystems.co.uk/tools/terminal-text-fixer.html) solves the terminal cleanup problem. **Markdown Multiverse** ports that pipeline into VS Code and extends it: two input pipelines (terminal and editor), six output formats (Clean, Markdown, Slack, Discord, Telegram, HTML), and a rich intermediate representation that preserves inline styles end-to-end.

Published open source at [github.com/geilt/markdown-multiverse-vscode](https://github.com/geilt/markdown-multiverse-vscode) and on the VS Code Marketplace under the publisher `geilt`.

**Brand umbrella:** "Markdown Multiverse" is the brand for a family of tools that convert between text formats. This repository holds the VS Code extension; future siblings may include a CLI (`markdown-multiverse-cli`) and a web tool (at markdown-multiverse.com).

## Phased scope

- **v1 (0.0.1)** — validate the core flow: right-click → clean copy to clipboard. One command, one pipeline. ✅
- **v2 (0.1.0)** — `Copy As` submenu with 6 format variants plus content classification. ✅
- **v2.1 (0.2.0)** — rich content pipeline: parse ANSI bold/italic/underline/strike + OSC 8 hyperlinks into a structured intermediate representation; each format renders inline styles natively. URL auto-detection. ✅
- **v2.2 (0.3.0)** — editor-side Copy As submenu in markdown files. Hand-rolled markdown parser produces a block AST; each format walks it with format-native block syntax (headings, lists, blockquotes, tables, code blocks). ✅
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

**Two tracks:** a flat-text path for `Copy as Clean`, a rich path for everything else.

```
raw terminal selection
        │
        ├─→ clean(raw): string          ← src/clean.ts — flat-text pipeline
        │         │                       used by Copy as Clean
        │         ▼
        │     clipboard.writeText
        │
        └─→ cleanRich(raw): Segment[]    ← src/cleanRich.ts — styled-char pipeline
                  │                        used by Markdown, Slack, Discord, Telegram, HTML
                  │
                  │  1. parseAnsi(raw) → StyledChar[]   (src/parse.ts)
                  │  2. char-level transforms (CR, BS, tabs, trailing WS, dedent, boxtables, reflow)
                  │  3. URL auto-linking
                  │  4. coalesce → Segment[]
                  │
                  ▼
          detectRich(segments) → ContentKind   (src/detect.ts)
                  │
                  ▼
          format(segments, kind) → string      (src/formats/*.ts)
                  │
                  ▼
          clipboard.writeText
```

`clean.ts`, `cleanRich.ts`, `parse.ts`, `rich.ts`, `detect.ts`, and every formatter have **zero VS Code imports** — pure libraries that run under `node --test` without any test host.

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

## The rich pipeline (`src/parse.ts` + `src/cleanRich.ts`)

### Types (`src/rich.ts`)

```ts
interface Style {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
}

interface StyledChar { ch: string; style: Style; }
interface Segment    { text: string; style: Style; }
```

### ANSI parser (`src/parse.ts`)

`parseAnsi(raw: string): StyledChar[]` walks the input and maintains a current style. Recognized sequences:

- **SGR** (`\e[Nm` / `\e[N;N;...m`):
  - `0` reset (preserves href)
  - `1` / `22` bold on/off
  - `3` / `23` italic on/off
  - `4` / `24` underline on/off
  - `9` / `29` strikethrough on/off
  - `38;5;N` / `38;2;R;G;B` / `48;...` — extended colors, parameters consumed and discarded
  - All other SGR params (30–37, 40–47, 90–97, 100–107) are ignored (color carries no semantic meaning for chat formats).
- **OSC 8 hyperlinks** (`\e]8;;URL\e\\` and `\e]8;;\u0007`): set/clear `style.href`.
- **Other OSC / CSI / ESC sequences** (title, cursor movement, etc.): consumed and discarded.
- Plain characters become `StyledChar` with the current style.

### Rich cleanup pipeline (`src/cleanRich.ts`)

Operates on `StyledChar[]` throughout, then coalesces into `Segment[]` at the end:

1. `resolveBackspaces` — walk chars, `\b` pops.
2. `resolveCarriageReturns` — per-line, simulate overwrite.
3. `stripQuoteMarkers` — remove `▎` chars.
4. `normalizeTabs` — expand each `\t` to N spaces, copying the current char's style.
5. `stripTrailingWhitespace` — per-line.
6. `stripPrompts` (optional) — same patterns as flat pipeline.
7. `dedentCommon` — detect min indent across non-blank lines, slice chars off the front of each line.
8. `convertBoxTables` — detect Unicode box-drawing blocks, project to plain text, convert to pipe tables, replace the block with fresh plain StyledChars.
9. `reflowParagraphs` — line-level join using the same predicates as the flat pipeline, working on styled lines.
10. `autoLinkUrls` — regex-scan the projected text for `https?://…`, apply `href` style to matched char ranges that don't already have one.
11. `collapseBlankLines` — runs of 3+ newlines → 2.
12. `trimTrailingNewlines`.
13. `coalesce` — adjacent chars with identical styles merged into a single Segment.

The trade-off: style preservation across line-level structural transforms (reflow, box tables) is lossy — reflow joins lines with a plain space, box tables strip all styles inside the block. In practice, terminal output styles rarely straddle these boundaries.

## The classifier (`src/detect.ts`)

```ts
export type ContentKind = 'table' | 'diff' | 'code' | 'prose';
export function detect(text: string): { kind: ContentKind };
export function detectRich(segments: Segment[]): { kind: ContentKind };
```

Flat-text detection order:

1. **Table** — every non-blank line matches `^\s*\|.*\|\s*$` AND at least one line is a separator.
2. **Diff** — contains a `@@ -X,Y +X,Y @@` hunk header, or 2+ lines start with `+ ` / `- ` and they're ≥50% of the content.
3. **Prose** — 2+ lines, >50% of lines start with a capital letter and end with `.`, `!`, or `?`.
4. **Code** — default.

`detectRich` calls `detect` on the projected plain text, then **upgrades non-table/non-diff content to `prose`** if any segment has inline style (`bold`, `italic`, `underline`, `strike`, `code`, or `href`). This is how Claude Code output (which is full of ANSI bold + OSC 8 links) gets rendered inline instead of fenced.

## The formats (`src/formats/*.ts`)

Each format is a pure `(segments: Segment[], kind: ContentKind) => string` function (except `toPlain` which still takes a flat string since Copy as Clean uses the flat pipeline).

Dispatch per kind:

| Format | Table | Diff | Code | Prose |
|--------|-------|------|------|-------|
| **plain** | — | — | — | flat string passthrough |
| **markdown** | plain pipe table | ``` fence | ``` fence | inline styles |
| **slack** | ``` fence | ``` fence | ``` fence | inline styles |
| **discord** | ``` fence | ```diff fence | ``` fence | inline styles |
| **telegram** | fence + escape | fence + escape | fence + escape | inline styles + escape |
| **html** | `<table>` | `<pre><code>` | `<pre><code>` | `<p>` + inline tags |

### Inline style rendering per format

| Style | Markdown | Slack | Discord | Telegram | HTML |
|-------|----------|-------|---------|----------|------|
| bold | `**x**` | `*x*` | `**x**` | `*x*` | `<strong>` |
| italic | `*x*` | `_x_` | `*x*` | `_x_` | `<em>` |
| underline | — | — | `__x__` | `__x__` | `<u>` |
| strike | `~~x~~` | `~x~` | `~~x~~` | `~x~` | `<s>` |
| inline code | `` `x` `` | `` `x` `` | `` `x` `` | `` `x` `` | `<code>` |
| link | `[t](u)` | `<u\|t>` | `[t](u)` | `[t](u)` | `<a href>` |

Details:

- **Whitespace-aware wrapping** — all formatters (via `src/formats/wrap.ts`) move leading/trailing whitespace outside the style markers, so `** bold **` (which doesn't render) becomes ` **bold** `.
- **Inside-out rendering** — inline code / bold / italic / strike wrap first, then the link wraps the whole thing. Result: `[**text**](url)`.
- **markdown** bumps to ```` when the cleaned content already contains ``` to avoid premature fence closure.
- **slack** always fences code/diff/table — Slack `mrkdwn` doesn't support tables at all, so the best rendering for tabular terminal output is a monospace code block.
- **discord** adds a `diff` language hint when the classifier sees diff content.
- **telegram** escapes MarkdownV2 reserved chars (`_*[]()~` `` ` `` `>#+-=|{}.!`) in prose text. Inside code blocks, only `` ` `` and `\` need escaping. Inside link URLs, only `)` and `\`.
- **html** entity-escapes `& < > " '`. For tables, parses Markdown pipe rows and emits `<table><thead><tr><th>` / `<tbody><tr><td>`. For prose, splits on blank lines and wraps each block in `<p>`.

## The markdown pipeline (`src/parseMd.ts`)

A separate pipeline for the editor context menu. Input is markdown source, not ANSI-styled terminal output.

### Block AST

```ts
type MdBlock =
  | { type: 'heading'; level: number; segments: Segment[] }
  | { type: 'paragraph'; segments: Segment[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'blockquote'; blocks: MdBlock[] }
  | { type: 'list'; ordered: boolean; items: MdBlock[][] }
  | { type: 'hr' }
  | { type: 'table'; header: Segment[][]; rows: Segment[][][] };
```

Inline content uses the same `Segment[]` type as the terminal pipeline. This means inline-rendering helpers (`renderSegment` in each format file) are shared between the terminal rich path and the markdown path.

### Parser structure

- **Block parser** (`parseBlocks`) — line-based state machine. Recognizes fenced code, ATX headings, horizontal rules, blockquotes, tables, lists, and paragraphs. Paragraphs collect non-blank lines until they hit a block start or blank line.
- **Inline parser** (`parseInline`) — single-pass character scanner. Recognizes inline code (atomic, highest priority), links `[text](url)` with balanced paren handling, bold `**…**` / `__…__`, italic `*…*` / `_…_`, strikethrough `~~…~~`. Nested styles recurse through `parseInline` on the inner text.

### Per-format block renderers

Each format file exports a `mdTo*(blocks: MdBlock[]): string` function that walks the AST:

| Block | Slack | Discord | Telegram (MarkdownV2) | HTML |
|-------|-------|---------|------------------------|------|
| heading | `*heading*` line | `# heading` native | `*heading*` line | `<h1>`…`<h6>` |
| paragraph | inline segments | inline segments | inline segments + escape | `<p>` |
| code block | ``` fence | ```lang fence | ``` fence + escape | `<pre><code class="language-…">` |
| blockquote | `> ` prefix | `> ` prefix | `>` prefix | `<blockquote>` |
| unordered list | `• ` items | `- ` items | `• ` items | `<ul><li>` |
| ordered list | `1. 2. 3.` | `1. 2. 3.` | `1\. 2\. 3\.` (escaped) | `<ol><li>` |
| horizontal rule | `----` | `---` | `\-\-\-` | `<hr>` |
| table | fenced plain | fenced plain | fenced plain | `<table><thead><tbody>` |

Slack / Discord / Telegram don't have real table support, so tables fall back to fenced monospace. Inline segments within table cells still get rendered through each format's `renderSegment` helper (except Telegram, where we emit plain text inside the code fence to avoid escape pollution).

## Commands, submenu, and settings

### Terminal commands

| Command | Title |
|---------|-------|
| `markdownMultiverse.copyClean` | Copy as Clean |
| `markdownMultiverse.copyMarkdown` | Copy as Markdown |
| `markdownMultiverse.copySlack` | Copy as Slack |
| `markdownMultiverse.copyDiscord` | Copy as Discord |
| `markdownMultiverse.copyTelegram` | Copy as Telegram |
| `markdownMultiverse.copyHtml` | Copy as HTML |

### Editor commands (markdown files only)

| Command | Title |
|---------|-------|
| `markdownMultiverse.editorCopySlack` | Copy Markdown as Slack |
| `markdownMultiverse.editorCopyDiscord` | Copy Markdown as Discord |
| `markdownMultiverse.editorCopyTelegram` | Copy Markdown as Telegram |
| `markdownMultiverse.editorCopyHtml` | Copy Markdown as HTML |

The editor submenu is gated by `editorLangId == markdown` in the VS Code `when`-clause system, so it only appears when the user right-clicks inside a markdown file. No `Copy as Clean` or `Copy as Markdown` entries since markdown source is already clean markdown.

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
