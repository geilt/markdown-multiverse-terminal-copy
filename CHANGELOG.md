# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - Unreleased

### Added
- Rebranded to **Markdown Multiverse — Terminal Copy Tool**.
- **Copy As** submenu in the terminal right-click menu with six format variants:
  - **Clean** — plain cleaned text (the v0.0.1 behavior).
  - **Markdown** — code-fenced, preserves detected tables and prose.
  - **Slack** — mrkdwn-fenced.
  - **Discord** — fenced with `diff` language hint when diff output is detected.
  - **Telegram** — MarkdownV2-fenced, escapes reserved chars.
  - **HTML** — `<table>` for pipe tables, `<pre><code>` for code, `<p>` for prose, with entity escaping.
- Content classifier (`src/detect.ts`) distinguishes table / diff / prose / code.
- 21 new unit tests (44 total, all passing).

### Changed
- Command namespace: `vscodeCopyTool.*` → `markdownMultiverse.*`.
- Settings namespace: `vscodeCopyTool.*` → `markdownMultiverse.*`.

## [0.0.1] - 2026-04-10

### Added
- Initial release under name "Copy Tool".
- `Copy Clean` command in the terminal right-click menu.
- Cleanup pipeline: strip ANSI, resolve `\r` overwrites, resolve `\b` overprinting, strip `▎` quote markers, normalize tabs, trim trailing whitespace, dedent common indent, convert box-drawing tables to Markdown, reflow wrapped prose.
