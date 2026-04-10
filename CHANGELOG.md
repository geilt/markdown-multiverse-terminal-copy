# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - Unreleased

### Added
- Initial release.
- `Copy Tool: Copy Clean` command in the terminal right-click menu.
- Cleanup pipeline: strip ANSI, resolve `\r` overwrites, resolve `\b` overprinting, strip `▎` quote markers, normalize tabs, trim trailing whitespace, dedent common indent, convert box-drawing tables to Markdown, reflow wrapped prose.
- Settings: `vscodeCopyTool.stripPrompts`, `vscodeCopyTool.tabWidth`.
