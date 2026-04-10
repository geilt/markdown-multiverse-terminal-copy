# vscode-copy-tool — Specification

## Context

Terminal output pasted into docs, issues, chat, or AI tools is usually ugly: ANSI color codes, carriage-return overwrites from spinners/progress bars, trailing whitespace, backspace overprinting from man pages, box-drawing tables, and soft-wrapped prose. The web tool at [missionsystems.co.uk/tools/terminal-text-fixer.html](https://www.missionsystems.co.uk/tools/terminal-text-fixer.html) solves this by running text through a pipeline of cleanups. This project ports that pipeline into a VS Code extension so users can **right-click a terminal selection and copy it cleanly in one step**, without leaving the editor.

## Phased scope

- **v1** — validate the core flow: right-click terminal selection → clean copy to clipboard. One command, one pipeline.
- **v2** — format variants: Copy for Slack, Copy for Telegram (wrap in code fences, escape target-specific reserved chars).
- **v3** — LLM/chat piping: Copy as Prompt, Send to LLM, Copy for ChatGPT / Copy for Claude. See **Future roadmap** below.

Published open source at [github.com/geilt/vscode-copy-tool](https://github.com/geilt/vscode-copy-tool) and on the VS Code Marketplace.

## Feasibility: how we read terminal selections

VS Code's stable API does **not** expose terminal selection text directly (tracking issue [microsoft/vscode#188173](https://github.com/microsoft/vscode/issues/188173)). The marketplace-safe workaround:

1. User right-clicks a terminal selection → picks our command.
2. Extension snapshots the current clipboard (`before`).
3. Extension runs the built-in command `workbench.action.terminal.copySelection`.
4. Extension reads `vscode.env.clipboard.readText()` (`raw`).
5. If `raw === before`, nothing was selected — bail with a status message, clipboard untouched.
6. Otherwise, run `raw` through the cleanup pipeline, optionally wrap it for a target format, and write the result back with `vscode.env.clipboard.writeText()`.
7. Show a brief status-bar message.

This uses only stable API, so the extension is marketplace-publishable. Menu registration uses the `terminal/context` contribution point, placing items in the terminal right-click menu under group `3_edit`.

## The cleanup pipeline (`src/clean.ts`)

Each step is a pure `(string) => string` function composed in order:

1. `stripAnsi` — remove SGR color/style codes, cursor movement, OSC title sequences, and bracketed paste mode markers.
2. `resolveCarriageReturns` — for each line, simulate overwrite behavior of `\r` so progress bars and spinners collapse to their final state.
3. `resolveBackspaces` — walk characters; `\b` deletes the previous char (resolves man-page bold/underline overprinting).
4. `stripQuoteMarkers` — remove the `▎` U+258E block-quote character Claude inserts in quoted responses.
5. `normalizeTabs` — replace `\t` with N spaces (`tabWidth` setting, default 4).
6. `stripTrailingWhitespace` — per-line trim of trailing spaces and tabs.
7. `stripPrompts` *(optional, off by default)* — remove common shell prompts (`user@host:~$`, `PS C:\>`, `>>>`, `$`, `#`).
8. `dedentCommon` — detect the largest common leading-whitespace prefix across non-blank lines and strip it if the majority share it.
9. `convertBoxTables` — detect Unicode box-drawing blocks and convert them into Markdown pipe tables. Passthrough on any parse failure.
10. `reflowParagraphs` — rejoin soft-wrapped prose lines, but **skip** blocks that look like diffs (`+`, `-`, `@@`), code (≥4-space indent), gutter-numbered output (`1:`, `1|`), lists, headings, or table rows.
11. Collapse runs of 3+ blank lines to 2, then `trimEnd()`.

The module has **zero VS Code imports** so it stays trivially testable and reusable by future v3 features (prompt wrapping, LLM calls, history).

Public surface:

```ts
export function clean(raw: string, opts?: {
  stripPrompts?: boolean;
  tabWidth?: number;
}): string;
```

## Commands and menu wiring

### v1

| Command | Title | Terminal menu group |
|---------|-------|---------------------|
| `vscodeCopyTool.copyClean` | Copy Tool: Copy Clean | `3_edit@10` |

### v2 (planned)

| Command | Title | Terminal menu group |
|---------|-------|---------------------|
| `vscodeCopyTool.copyForSlack` | Copy Tool: Copy for Slack | `3_edit@11` |
| `vscodeCopyTool.copyForTelegram` | Copy Tool: Copy for Telegram | `3_edit@12` |

### Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `vscodeCopyTool.stripPrompts` | boolean | `false` | Strip common shell prompt prefixes. Destructive. |
| `vscodeCopyTool.tabWidth` | number | `4` | Spaces per tab. |

## Command implementation shape

```ts
async function copyViaPipeline(format: (s: string) => string) {
  const cfg = vscode.workspace.getConfiguration('vscodeCopyTool');
  const before = await vscode.env.clipboard.readText();
  await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
  const raw = await vscode.env.clipboard.readText();
  if (raw === before) {
    vscode.window.setStatusBarMessage('Copy Tool: no terminal selection', 2000);
    return;
  }
  const cleaned = format(clean(raw, {
    stripPrompts: cfg.get('stripPrompts'),
    tabWidth: cfg.get('tabWidth'),
  }));
  await vscode.env.clipboard.writeText(cleaned);
  vscode.window.setStatusBarMessage('Copy Tool: copied clean text', 2000);
}
```

The pipeline is structured as `acquire selection → clean → format → sink`. In v1 the format is identity and the sink is the clipboard. Future commands swap `format` (Slack wrapper, prompt template) or `sink` (new editor, LLM request, shell pipe).

## Future roadmap (v3+)

The whole point of normalizing terminal output is that once it's clean, it's useful everywhere else.

### 1. Copy as Prompt

Wrap cleaned output in a user-defined prompt template:

```
Here is the output of a command I ran. Explain what it means and any errors:

```
{{cleaned}}
```
```

Settings key: `vscodeCopyTool.promptTemplates` — an array of named templates with `{{cleaned}}` as the placeholder. The terminal right-click menu shows a submenu listing them.

### 2. Send to LLM

Post the cleaned (optionally prompt-wrapped) text directly to a configured endpoint. MVP targets:

- Anthropic Messages API (`claude-opus-4-6`, `claude-sonnet-4-6`)
- OpenAI Chat Completions
- Local Ollama (`http://localhost:11434`)

API keys stored via VS Code `SecretStorage`, **never** in `settings.json`. Response opens in a new untitled Markdown editor or a side webview.

### 3. Target-specific copy

- `Copy for ChatGPT` / `Copy for Claude` / `Copy for Gemini` — each with a tuned preamble.
- `Copy for GitHub Issue` — wraps in `<details><summary>Terminal output</summary>` collapsible blocks.
- `Copy for Markdown` — fences plus an optional language hint.
- `Copy for Jira` — Atlassian wiki markup (`{code}...{code}`).

### 4. Pipe through external command

`Copy through…` opens a QuickPick of user-configured shell commands (e.g. `jq`, `glow`, `pbcopy`) and pipes cleaned text through the chosen one. Settings key: `vscodeCopyTool.pipes`. Uses `execFile`-style arg arrays, never shell string concat.

### 5. Save to file

`Copy Clean to New File` opens the cleaned text in a new untitled editor instead of the clipboard.

### 6. History

Last N cleaned copies stored in `globalState`, surfaced via `Copy Tool: Show History` (QuickPick).

## Verification

### Unit tests

Tests live in `src/test/clean.test.ts` and run with `node --test`. Because `clean.ts` has no VS Code dependencies, no test host is needed.

Required coverage:

- ANSI-colored `ls --color` output → escapes stripped.
- `curl` progress bar with `\r` overwrites → only final state survives.
- `man bash` excerpt with backspace overprinting → clean text.
- Claude terminal reply with `▎` quote marker → stripped.
- `tree` box-drawing → pipe table (or passthrough).
- Wrapped `git log` prose → reflowed.
- `grep -n` gutter output → NOT reflowed across lines.
- Prompts stripped only when the option is on.

### End-to-end manual test

Press <kbd>F5</kbd> in VS Code to launch the Extension Development Host.

1. Open a terminal. Run `ls --color=always` in a directory with varied file types.
2. Select a few colored lines. Right-click → **Copy Tool: Copy Clean**.
3. Paste into a new file. Expect: no escape codes, no trailing spaces, tabs as 4 spaces.
4. Run `curl -o /dev/null https://speed.cloudflare.com/__down?bytes=10000000` to get a progress bar. Select the progress block. Copy Clean → paste should show only the final state.
5. Select nothing. Click Copy Clean. Expect: "no terminal selection" status message, clipboard untouched.
6. `cat` a file with trailing whitespace. Copy Clean → paste should be clean.

### Marketplace packaging smoke test

```sh
npx @vscode/vsce package
code --install-extension vscode-copy-tool-0.0.1.vsix
```

Repeat the E2E tests in a real (non-dev-host) window.
