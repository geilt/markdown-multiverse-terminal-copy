# Markdown Multiverse

> Copy what you see, paste where you need it.

A VS Code extension that takes selected text from your terminal or markdown editor and copies it in the format you actually need — Slack-flavored, Discord-flavored, Telegram, HTML, or plain — with all the ugly bits (ANSI escapes, progress bars, wrapped lines) cleaned up automatically.

## Why

Terminal output and markdown look great in their native environment and awful everywhere else. Copy a nicely colored `git log` into Slack and you get a wall of `\e[33m` garbage. Copy a markdown heading into Discord and it loses its formatting. Copy a box-drawing table anywhere non-monospace and alignment breaks.

Markdown Multiverse fixes this at the copy step. Instead of one "Copy" that gives you the raw bytes, you get a **Copy As** submenu with destination-aware variants. Each variant knows how to render headings, lists, links, bold/italic, tables, and code blocks natively for its target.

## Two pipelines

### 1. Terminal → anywhere

Right-click a terminal selection → **Copy As**:

- **Clean** — pure plain text with ANSI stripped, carriage-return overwrites resolved, backspace overprinting resolved, tables reflowed, trailing whitespace trimmed. Pipe it into anything.
- **Markdown** — fences code/diff blocks, passes through prose, preserves detected tables.
- **Slack** (mrkdwn), **Discord**, **Telegram** (MarkdownV2), **HTML** — each applies destination-native inline styles.

When the terminal output contains ANSI bold, italic, underline, strikethrough, or OSC 8 hyperlinks (hi Claude Code, `git log`, modern CLIs), those styles are parsed into a structured intermediate representation and re-emitted as the target's native syntax:

| Style in terminal | Markdown | Slack | Discord | HTML |
|-------------------|----------|-------|---------|------|
| ANSI bold | `**bold**` | `*bold*` | `**bold**` | `<strong>` |
| ANSI italic | `*italic*` | `_italic_` | `*italic*` | `<em>` |
| OSC 8 link | `[text](url)` | `<url\|text>` | `[text](url)` | `<a href>` |
| Inline code | `` `code` `` | `` `code` `` | `` `code` `` | `<code>` |

Plain `https://…` URLs are auto-detected and upgraded to links even when the terminal doesn't emit OSC 8 hyperlinks.

### 2. Markdown file → anywhere

Right-click a selection in any `.md` file → **Copy As**:

- **Slack** — headings become bold lines, `- ` bullets become `• `, links become `<url|text>`, code blocks stay fenced.
- **Discord** — keeps native `#` headings (Discord supports them), markdown bullets, `[text](url)` links, ```lang fenced code.
- **Telegram** — MarkdownV2 with reserved chars escaped, `*heading*` lines, `>` quotes, fenced code.
- **HTML** — semantic `<h1>`-`<h6>`, `<ul>`/`<ol>`, `<blockquote>`, `<pre><code class="language-…">`, `<table>` with real `<thead>`/`<tbody>`.

The editor submenu only appears when `editorLangId == markdown`, so it won't clutter your right-click menu in other file types. There's no Clean or Markdown entry since markdown source is already clean markdown.

If nothing is selected when you right-click, the entire file is converted.

## Content classification

A small classifier decides how to render each chunk:

| Kind | How it's detected | What formats do with it |
|------|-------------------|-------------------------|
| **table** | pipe-table rows + separator line | HTML → `<table>`, others → fenced |
| **diff** | `@@ -X,Y +X,Y @@` hunk or ≥50% `+ `/`- ` lines | Discord → ```diff fence, others → plain fence |
| **prose** | sentences starting with capitals, OR any inline styles present | inline styles rendered, no fence |
| **code** | default | fenced in every chat target |

The classifier is deliberately conservative: `ls -la` output (with many `-rw-r--r--` lines) stays classified as **code**, not diff.

## Cleanup pipeline

Whether you pick Clean, Markdown, or any chat target, the terminal input first goes through:

- Strip ANSI color codes, cursor movement, OSC title sequences, bracketed-paste markers.
- Resolve carriage-return overwrites (progress bars and spinners collapse to their final state).
- Resolve backspace overprinting (man-page bold becomes plain text).
- Strip the `▎` U+258E block-quote character Claude Code uses in quoted responses.
- Normalize tabs to spaces (configurable width).
- Trim trailing whitespace.
- Strip common shell prompts (optional, off by default — destructive).
- Dedent shared leading whitespace.
- Convert Unicode box-drawing tables to Markdown pipe tables.
- Reflow soft-wrapped prose while preserving diffs, code, gutter-numbered output, and lists.
- Auto-link plain URLs.
- Collapse runs of 3+ blank lines to 2.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `markdownMultiverse.stripPrompts` | `false` | Strip common shell prompt prefixes (`user@host:~$`, `PS C:\>`, `>>>`, `$`, `#`). Destructive. |
| `markdownMultiverse.tabWidth` | `4` | Number of spaces to substitute for tab characters. |

## Keyboard shortcuts

Every command is bindable via VS Code's built-in keyboard shortcut system. **No default bindings are set**, so there are no conflicts with other extensions.

To bind a shortcut:

1. Open **Preferences → Keyboard Shortcuts** (<kbd>⌘K ⌘S</kbd> on macOS, <kbd>Ctrl+K Ctrl+S</kbd> elsewhere).
2. Search for "Markdown Multiverse".
3. Click the pencil icon next to a command and press your desired key combination.

All commands at a glance:

| Command | Description |
|---------|-------------|
| `markdownMultiverse.copyClean` | Terminal → plain text |
| `markdownMultiverse.copyMarkdown` | Terminal → Markdown |
| `markdownMultiverse.copySlack` | Terminal → Slack mrkdwn |
| `markdownMultiverse.copyDiscord` | Terminal → Discord |
| `markdownMultiverse.copyTelegram` | Terminal → Telegram MarkdownV2 |
| `markdownMultiverse.copyHtml` | Terminal → HTML |
| `markdownMultiverse.editorCopySlack` | Markdown file → Slack |
| `markdownMultiverse.editorCopyDiscord` | Markdown file → Discord |
| `markdownMultiverse.editorCopyTelegram` | Markdown file → Telegram |
| `markdownMultiverse.editorCopyHtml` | Markdown file → HTML |

Tip: if you want to scope a shortcut to "only in terminal" or "only in markdown files", use VS Code's `when` clause in your `keybindings.json`:

```jsonc
{
  "key": "cmd+shift+c",
  "command": "markdownMultiverse.copyClean",
  "when": "terminalFocus"
}
```

## Architecture

```
┌─ Terminal selection (raw ANSI bytes)
│      │
│      ├─→ clean(raw) ────→ string             (Copy as Clean)
│      │
│      └─→ cleanRich(raw) ─→ Segment[]         (all other formats)
│              │                  │
│              │                  ├─ ANSI parser (parse.ts)
│              │                  ├─ Styled-char pipeline
│              │                  └─ URL auto-linking
│              ▼
│          detectRich → ContentKind
│              │
│              └─→ format(segments, kind) → string
│
└─ Editor selection (markdown source)
       │
       ├─→ parseMarkdown(text) → MdBlock[]
       │                              │
       │                              └─ block AST with Segment[] for inline
       ▼
   mdTo{Slack,Discord,Telegram,Html}(blocks) → string
```

Every core library (`clean.ts`, `cleanRich.ts`, `parse.ts`, `parseMd.ts`, `rich.ts`, `detect.ts`, all formatters) has **zero VS Code imports**, so the entire pipeline runs under `node --test` with no test host. See [`docs/spec/README.md`](docs/spec/README.md) for the full design doc.

## Roadmap

### Near term

- **Copy as Prompt** — wrap any selection in a user-defined LLM prompt template (`{{cleaned}}` placeholder). Templates stored in settings, available as submenu entries.
- **Send to LLM** — post the cleaned/converted text directly to Anthropic Messages API, OpenAI Chat Completions, or a local Ollama endpoint. API keys in `SecretStorage`. Response opens in a side panel or new editor.
- **Target-specific formats** — GitHub Issue (`<details>` collapsibles), Jira wiki markup (`{code}…{code}`), ChatGPT/Claude/Gemini with tuned preambles.

### Medium term

- **Pipe through external command** — `Copy through…` quickpick of user-configured shell commands (e.g. `jq`, `glow`, `pbcopy`) with `execFile`-style arg arrays.
- **Copy to new editor** — for long outputs, open the converted text in a new untitled editor instead of the clipboard.
- **History** — last N copies stored in `globalState`, surfaced via `Markdown Multiverse: Show History` quickpick.
- **Content-based editor gating** — show the editor Copy As submenu not just in `.md` files but anywhere the selected text looks like markdown.

### Long term

- **Markdown Multiverse CLI** — same pipeline as a standalone `npx` tool for shell scripts and CI.
- **Markdown Multiverse Web** — browser-based version at markdown-multiverse.com so you can paste any text and convert it without installing anything.

## Development

```sh
git clone https://github.com/geilt/markdown-multiverse-vscode.git
cd markdown-multiverse-vscode
npm install
npm run compile
npm test
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with the extension loaded. See [`docs/spec/README.md`](docs/spec/README.md) for architecture details.

### Testing

```sh
npm test
```

126 tests covering the ANSI parser, terminal cleanup pipeline, rich formatters, markdown parser, and markdown renderers. Every test runs under `node --test` with no VS Code dependency.

## Contributing

PRs welcome. Open an issue first for anything larger than a bug fix so we can align on approach.

## Credits

Cleanup pipeline inspired by the excellent [Terminal Text Fixer](https://www.missionsystems.co.uk/tools/terminal-text-fixer.html) by Mission Systems.

## License

[MIT](LICENSE)
