import * as vscode from 'vscode';
import { clean, CleanOptions } from './clean';
import { toPlain } from './formats/plain';
import { toMarkdown } from './formats/markdown';
import { toSlack } from './formats/slack';
import { toTelegram } from './formats/telegram';
import { toDiscord } from './formats/discord';
import { toHtml } from './formats/html';

type Formatter = (cleaned: string) => string;

async function copyViaPipeline(label: string, format: Formatter): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('markdownMultiverse');
  const opts: CleanOptions = {
    stripPrompts: cfg.get<boolean>('stripPrompts', false),
    tabWidth: cfg.get<number>('tabWidth', 4)
  };

  const before = await vscode.env.clipboard.readText();
  await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
  const raw = await vscode.env.clipboard.readText();

  if (raw === before) {
    vscode.window.setStatusBarMessage('$(info) Markdown Multiverse: no terminal selection', 2000);
    return;
  }

  const cleaned = format(clean(raw, opts));
  await vscode.env.clipboard.writeText(cleaned);
  vscode.window.setStatusBarMessage(`$(check) Markdown Multiverse: copied as ${label}`, 2000);
}

export function activate(context: vscode.ExtensionContext): void {
  const commands: Array<[string, string, Formatter]> = [
    ['markdownMultiverse.copyClean', 'Clean', toPlain],
    ['markdownMultiverse.copyMarkdown', 'Markdown', toMarkdown],
    ['markdownMultiverse.copySlack', 'Slack', toSlack],
    ['markdownMultiverse.copyTelegram', 'Telegram', toTelegram],
    ['markdownMultiverse.copyDiscord', 'Discord', toDiscord],
    ['markdownMultiverse.copyHtml', 'HTML', toHtml]
  ];

  for (const [id, label, formatter] of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, () => copyViaPipeline(label, formatter))
    );
  }
}

export function deactivate(): void {
  // no-op
}
