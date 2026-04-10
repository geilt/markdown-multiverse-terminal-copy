# Markdown Multiverse — Terminal Copy Tool

Right-click in the VS Code integrated terminal to copy selected output, **cleaned up and formatted for wherever you're pasting it**: Markdown, Slack, Discord, Telegram, HTML, or plain.

Terminal output is usually ugly — ANSI colors, progress-bar overwrites, tab stops, wrapped prose, trailing whitespace. Markdown Multiverse strips all that, then **parses ANSI bold / italic / underline / strike / OSC 8 hyperlinks** into an intermediate representation and re-renders them as format-native inline syntax:

- Bold terminal text → `**bold**` (Markdown), `*bold*` (Slack), `<strong>` (HTML), and so on.
- OSC 8 hyperlinks from Claude Code, `git log`, etc. → `[text](url)` / `<url|text>` / `<a href>`.
- Plain `https://…` URLs are auto-detected and upgraded to links even without OSC 8.
- Tables get pipe tables for Markdown, real `<table>` for HTML, fences for chat apps.

**Copy as Clean** still gives you pure plain text with nothing wrapped — useful when you just want the raw content.

Inspired by the excellent [Terminal Text Fixer](https://www.missionsystems.co.uk/tools/terminal-text-fixer.html), built directly into VS Code.

## Usage

1. Select text in any integrated terminal.
2. Right-click → **Copy As** → pick your destination.
3. Paste anywhere.

### Formats

| Format | Prose (with inline styles) | Code / diff | Table |
|--------|---------------------------|-------------|-------|
| **Clean** | plain text | plain text | plain text |
| **Markdown** | `**bold**` `*italic*` `` `code` `` `[text](url)` | ``` fence | pipe table |
| **Slack** | `*bold*` `_italic_` `` `code` `` `<url\|text>` | ``` fence | ``` fence |
| **Discord** | `**bold**` `*italic*` `__underline__` `[text](url)` | ```diff fence | ``` fence |
| **Telegram** | MarkdownV2 with reserved chars escaped | ``` fence | ``` fence |
| **HTML** | `<strong>`, `<em>`, `<a href>`, `<code>` | `<pre><code>` | `<table>` |

### Content detection

The extension runs the cleaned text through a classifier that recognizes:

- **Pipe tables** (including box-drawing tables already converted during cleanup) — HTML renders as real `<table>`, Markdown passes through.
- **Diff output** (unified diff with `@@` hunks or `-` / `+` prefix lines) — Discord adds a `diff` language hint.
- **Prose with inline styles** — whenever the content contains ANSI bold, italic, underline, strikethrough, inline code, or OSC 8 hyperlinks, it's treated as rich prose and rendered inline (no fence).
- **Code / terminal output** (the default) — fenced in code blocks for every chat target.

## What gets cleaned

- **ANSI escape codes** — SGR colors, cursor movement, OSC title sequences, bracketed paste markers.
- **Carriage-return overwrites** — progress bars and spinners collapse to their final state.
- **Backspace overprinting** — man-page bold/underline becomes plain text.
- **Trailing whitespace** — per-line trim.
- **Tab normalization** — tabs become consistent spaces (configurable).
- **Common indentation** — shared leading whitespace gets dedented.
- **Box-drawing tables** — Unicode `┌─┬┐` tables convert to Markdown pipe tables.
- **Soft-wrapped prose** — rejoined into single paragraphs (diffs, code, and numbered output are preserved).
- **Claude quote markers** — the `▎` character gets stripped.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `markdownMultiverse.stripPrompts` | `false` | Strip common shell prompt prefixes (`user@host:~$`, `PS C:\>`, `>>>`, `$`). Destructive. |
| `markdownMultiverse.tabWidth` | `4` | Number of spaces to substitute for tab characters. |

## Roadmap

- **v3** — Copy as Prompt (user-defined LLM prompt templates), Send to LLM (Anthropic / OpenAI / Ollama), target-specific copy (GitHub Issue, Jira).

See [`docs/spec/README.md`](docs/spec/README.md) for the full design.

## Development

```sh
npm install
npm run compile
npm test
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host with the extension loaded.

## License

[MIT](LICENSE)
