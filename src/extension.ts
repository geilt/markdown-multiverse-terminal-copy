import * as vscode from 'vscode';
import { clean, CleanOptions } from './clean';

type Formatter = (cleaned: string) => string;

const plain: Formatter = (s) => s;

async function copyViaPipeline(format: Formatter): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('vscodeCopyTool');
  const opts: CleanOptions = {
    stripPrompts: cfg.get<boolean>('stripPrompts', false),
    tabWidth: cfg.get<number>('tabWidth', 4)
  };

  const before = await vscode.env.clipboard.readText();
  await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
  const raw = await vscode.env.clipboard.readText();

  if (raw === before) {
    vscode.window.setStatusBarMessage('$(info) Copy Tool: no terminal selection', 2000);
    return;
  }

  const cleaned = format(clean(raw, opts));
  await vscode.env.clipboard.writeText(cleaned);
  vscode.window.setStatusBarMessage('$(check) Copy Tool: copied clean text', 2000);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('vscodeCopyTool.copyClean', () => copyViaPipeline(plain))
  );
}

export function deactivate(): void {
  // no-op
}
