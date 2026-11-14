import { randomBytes } from 'crypto';
import type * as vscode from 'vscode';

/**
 * A button on an editor page; `id` is what the page posts back when clicked
 */
export interface PageAction {
  readonly id: string;
  readonly label: string;
}

/**
 * What the custom editor shows in place of a file's text: a heading, a
 * sentence or two, and the things the user can do next
 */
export interface EditorPage {
  readonly heading: string;
  readonly message: string;
  readonly actions: readonly PageAction[];
}

/**
 * Show `page` in a webview, styled like VS Code's own placeholder for files
 * it cannot display. The first action is the primary button.
 */
export function showPage(webview: vscode.Webview, page: EditorPage): void {
  const nonce = randomBytes(16).toString('base64');
  const buttons = page.actions
    .map(
      (action, index) =>
        `<button class="${index === 0 ? 'primary' : 'secondary'}" data-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`,
    )
    .join('');

  webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 2em;
    max-width: 48em;
  }
  h2 { font-weight: 600; margin-top: 0; }
  p { line-height: 1.5; }
  .actions { display: flex; gap: 0.5em; flex-wrap: wrap; margin-top: 1.5em; }
  button {
    font-family: inherit;
    font-size: inherit;
    padding: 4px 12px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    cursor: pointer;
  }
  button.primary {
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
  }
  button.primary:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    color: var(--vscode-button-secondaryForeground);
    background: var(--vscode-button-secondaryBackground);
  }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
</style>
</head>
<body>
<h2>${escapeHtml(page.heading)}</h2>
<p>${escapeHtml(page.message)}</p>
<div class="actions">${buttons}</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  for (const button of document.querySelectorAll('button[data-action]')) {
    button.addEventListener('click', () =>
      vscode.postMessage({ action: button.dataset.action }),
    );
  }
</script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
