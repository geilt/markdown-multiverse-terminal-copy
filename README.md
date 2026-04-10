# Copy Tool for VS Code

Right-click in the integrated terminal to copy selected output **cleanly** — strips ANSI color codes, resolves carriage-return overwrites and backspace overprinting, trims trailing whitespace, dedents, and reflows wrapped prose.

Inspired by the excellent [Terminal Text Fixer](https://www.missionsystems.co.uk/tools/terminal-text-fixer.html), but built directly into VS Code so you never leave the editor.

## Usage

1. Select text in any integrated terminal.
2. Right-click → **Copy Tool: Copy Clean**.
3. Paste anywhere — the output is already cleaned up.

## What it cleans

- **ANSI escape codes** — SGR colors, cursor movement, OSC title sequences, bracketed paste markers.
- **Carriage-return overwrites** — progress bars and spinners collapse to their final state.
- **Backspace overprinting** — man-page bold/underline rendering becomes plain text.
- **Trailing whitespace** — per-line trim.
- **Tab normalization** — tabs become consistent spaces (configurable).
- **Common indentation** — shared leading whitespace gets dedented.
- **Box-drawing tables** — Unicode `┌─┬┐` tables convert to Markdown pipe tables.
- **Soft-wrapped prose** — rejoined into single paragraphs (diffs, code, and numbered output are preserved).
- **Claude quote markers** — the `▎` character gets stripped.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vscodeCopyTool.stripPrompts` | `false` | Strip common shell prompt prefixes (`user@host:~$`, `PS C:\>`, `>>>`, `$`, `#`). Destructive — may affect non-prompt content matching these patterns. |
| `vscodeCopyTool.tabWidth` | `4` | Number of spaces to substitute for tab characters. |

## Roadmap

- **v2** — Copy for Slack, Copy for Telegram (target-specific formatting).
- **v3** — Copy as Prompt, Send to LLM (Anthropic / OpenAI / Ollama), Copy for ChatGPT / Claude / GitHub Issue / Jira.

See [`docs/spec/README.md`](docs/spec/README.md) for the full design.

## Development

```sh
npm install
npm run compile
npm test
```

Press <kbd>F5</kbd> to launch an Extension Development Host.

## License

[MIT](LICENSE)
