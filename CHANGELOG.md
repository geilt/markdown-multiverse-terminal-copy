# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - Unreleased

### Added
- **Rich content pipeline.** The five non-plain formats (Markdown, Slack, Discord, Telegram, HTML) now parse ANSI styles into a structured intermediate representation and render them as format-native inline syntax. Bold, italic, underline, strikethrough, inline code, and OSC 8 hyperlinks all round-trip.
  - `src/parse.ts` — ANSI parser: SGR bold/italic/underline/strike, OSC 8 hyperlinks, with color/cursor/title escapes stripped.
  - `src/rich.ts` — shared types (`Style`, `Segment`, `StyledChar`) and helpers (`coalesce`, `splitLines`).
  - `src/cleanRich.ts` — parallel cleanup pipeline that operates on styled chars (CR/BS/tabs/whitespace/dedent/boxtables/reflow) and coalesces into segments.
- **URL auto-detection.** Plain `https://…` URLs in terminal output are upgraded to format-native links even without OSC 8 wrapping.
- **Inline style rendering per format:**
  - **Markdown:** `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `[text](url)`.
  - **Slack (mrkdwn):** `*bold*`, `_italic_`, `~strike~`, `` `code` ``, `<url|text>`.
  - **Discord:** `**bold**`, `*italic*`, `__underline__`, `~~strike~~`, `[text](url)`.
  - **Telegram (MarkdownV2):** `*bold*`, `_italic_`, `__underline__`, `~strike~`, with reserved chars escaped outside code.
  - **HTML:** `<strong>`, `<em>`, `<u>`, `<s>`, `<code>`, `<a href>`, all with entity escaping.
- **Smart prose detection.** When styled segments are present, the classifier bumps the content into the `prose` track so formats render inline styles instead of fencing.
- 40 new tests covering parser, rich cleanup, and rich formatters (84 total).

### Changed
- Format functions now take `(segments, kind)` instead of `(cleaned)`. Internal API only — command IDs and the user-facing menu are unchanged.
- `Copy as Clean` still uses the original flat-text `clean()` pipeline for users who want pure plain text.

## [0.1.0] - 2026-04-10

### Added
- Rebranded to **Markdown Multiverse — Terminal Copy Tool**.
- **Copy As** submenu in the terminal right-click menu with six format variants.
- Content classifier (`src/detect.ts`) distinguishes table / diff / prose / code.

### Changed
- Command namespace: `vscodeCopyTool.*` → `markdownMultiverse.*`.

## [0.0.1] - 2026-04-10

### Added
- Initial release under name "Copy Tool".
- `Copy Clean` command in the terminal right-click menu.
- Cleanup pipeline: strip ANSI, resolve `\r` overwrites, resolve `\b` overprinting, strip `▎` quote markers, normalize tabs, trim trailing whitespace, dedent, convert box-drawing tables, reflow wrapped prose.
