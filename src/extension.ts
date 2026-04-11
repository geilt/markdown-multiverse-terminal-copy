import * as vscode from 'vscode';
import { clean, CleanOptions } from './clean';
import { cleanRich } from './cleanRich';
import { detectRich, ContentKind } from './detect';
import { Segment } from './rich';
import { parseMarkdown, MdBlock } from './parseMd';
import { toPlain } from './formats/plain';
import { toMarkdown } from './formats/markdown';
import { toSlack, mdToSlack } from './formats/slack';
import { toTelegram, mdToTelegram } from './formats/telegram';
import { toDiscord, mdToDiscord } from './formats/discord';
import { toHtml, mdToHtml } from './formats/html';

type RichFormatter = (segments: Segment[], kind: ContentKind) => string;
type MdFormatter = (blocks: MdBlock[]) => string;

function readOpts(): CleanOptions {
  const cfg = vscode.workspace.getConfiguration('markdownMultiverse');
  return {
    stripPrompts: cfg.get<boolean>('stripPrompts', false),
    tabWidth: cfg.get<number>('tabWidth', 4)
  };
}

function flash(message: string): void {
  vscode.window.setStatusBarMessage(message, 2000);
}

async function acquireTerminalSelection(): Promise<string | null> {
  const before = await vscode.env.clipboard.readText();
  await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
  const raw = await vscode.env.clipboard.readText();
  return raw === before ? null : raw;
}

async function copyClean(): Promise<void> {
  const raw = await acquireTerminalSelection();
  if (raw === null) {
    flash('$(info) Markdown Multiverse: no terminal selection');
    return;
  }
  await vscode.env.clipboard.writeText(toPlain(clean(raw, readOpts())));
  flash('$(check) Markdown Multiverse: copied as Clean');
}

async function copyTerminalRich(label: string, format: RichFormatter): Promise<void> {
  const raw = await acquireTerminalSelection();
  if (raw === null) {
    flash('$(info) Markdown Multiverse: no terminal selection');
    return;
  }
  const segments = cleanRich(raw, readOpts());
  const { kind } = detectRich(segments);
  await vscode.env.clipboard.writeText(format(segments, kind));
  flash(`$(check) Markdown Multiverse: copied as ${label}`);
}

async function copyEditorMarkdown(label: string, render: MdFormatter): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    flash('$(info) Markdown Multiverse: no active editor');
    return;
  }
  const selection = editor.selection;
  const text = selection.isEmpty ? editor.document.getText() : editor.document.getText(selection);
  if (text.trim() === '') {
    flash('$(info) Markdown Multiverse: empty selection');
    return;
  }
  const blocks = parseMarkdown(text);
  await vscode.env.clipboard.writeText(render(blocks));
  flash(`$(check) Markdown Multiverse: copied as ${label}`);
}

export function activate(context: vscode.ExtensionContext): void {
  const terminalRich: Array<[string, string, RichFormatter]> = [
    ['markdownMultiverse.copyMarkdown', 'Markdown', toMarkdown],
    ['markdownMultiverse.copySlack', 'Slack', toSlack],
    ['markdownMultiverse.copyTelegram', 'Telegram', toTelegram],
    ['markdownMultiverse.copyDiscord', 'Discord', toDiscord],
    ['markdownMultiverse.copyHtml', 'HTML', toHtml]
  ];

  const editorMd: Array<[string, string, MdFormatter]> = [
    ['markdownMultiverse.editorCopySlack', 'Slack', mdToSlack],
    ['markdownMultiverse.editorCopyDiscord', 'Discord', mdToDiscord],
    ['markdownMultiverse.editorCopyTelegram', 'Telegram', mdToTelegram],
    ['markdownMultiverse.editorCopyHtml', 'HTML', mdToHtml]
  ];

  context.subscriptions.push(vscode.commands.registerCommand('markdownMultiverse.copyClean', copyClean));
  for (const [id, label, formatter] of terminalRich) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => copyTerminalRich(label, formatter))
    );
  }
  for (const [id, label, render] of editorMd) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => copyEditorMarkdown(label, render))
    );
  }
}

export function deactivate(): void {
  // no-op
}
