import * as vscode from 'vscode';
import { clean, CleanOptions } from './clean';
import { cleanRich } from './cleanRich';
import { detectRich, ContentKind } from './detect';
import { Segment } from './rich';
import { toPlain } from './formats/plain';
import { toMarkdown } from './formats/markdown';
import { toSlack } from './formats/slack';
import { toTelegram } from './formats/telegram';
import { toDiscord } from './formats/discord';
import { toHtml } from './formats/html';

type RichFormatter = (segments: Segment[], kind: ContentKind) => string;

function readOpts(): CleanOptions {
  const cfg = vscode.workspace.getConfiguration('markdownMultiverse');
  return {
    stripPrompts: cfg.get<boolean>('stripPrompts', false),
    tabWidth: cfg.get<number>('tabWidth', 4)
  };
}

async function acquireSelection(): Promise<string | null> {
  const before = await vscode.env.clipboard.readText();
  await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
  const raw = await vscode.env.clipboard.readText();
  return raw === before ? null : raw;
}

async function copyClean(): Promise<void> {
  const raw = await acquireSelection();
  if (raw === null) {
    vscode.window.setStatusBarMessage('$(info) Markdown Multiverse: no terminal selection', 2000);
    return;
  }
  await vscode.env.clipboard.writeText(toPlain(clean(raw, readOpts())));
  vscode.window.setStatusBarMessage('$(check) Markdown Multiverse: copied as Clean', 2000);
}

async function copyRich(label: string, format: RichFormatter): Promise<void> {
  const raw = await acquireSelection();
  if (raw === null) {
    vscode.window.setStatusBarMessage('$(info) Markdown Multiverse: no terminal selection', 2000);
    return;
  }
  const segments = cleanRich(raw, readOpts());
  const { kind } = detectRich(segments);
  await vscode.env.clipboard.writeText(format(segments, kind));
  vscode.window.setStatusBarMessage(`$(check) Markdown Multiverse: copied as ${label}`, 2000);
}

export function activate(context: vscode.ExtensionContext): void {
  const rich: Array<[string, string, RichFormatter]> = [
    ['markdownMultiverse.copyMarkdown', 'Markdown', toMarkdown],
    ['markdownMultiverse.copySlack', 'Slack', toSlack],
    ['markdownMultiverse.copyTelegram', 'Telegram', toTelegram],
    ['markdownMultiverse.copyDiscord', 'Discord', toDiscord],
    ['markdownMultiverse.copyHtml', 'HTML', toHtml]
  ];

  context.subscriptions.push(vscode.commands.registerCommand('markdownMultiverse.copyClean', copyClean));
  for (const [id, label, formatter] of rich) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => copyRich(label, formatter))
    );
  }
}

export function deactivate(): void {
  // no-op
}
