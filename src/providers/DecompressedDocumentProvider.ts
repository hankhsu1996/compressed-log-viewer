import * as path from 'path';
import * as vscode from 'vscode';
import {
  CompressionFormat,
  findFormat,
  readPreview,
  withoutSuffix,
} from '../decompressors/formats';
import { describeFailure } from '../failureMessages';

/** URI scheme of the read-only documents that show decompressed text */
export const DECOMPRESSED_SCHEME = 'compressed-log-viewer';

/** Files that decompress to more than this are offered for saving, not shown */
export const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

/**
 * The URI of the document showing a compressed file's text
 *
 * Its path is the file's own path without the format's suffix, so the tab
 * reads `app.log` and VS Code picks the language from `.log`; the compressed
 * file's URI is kept whole in the query.
 */
export function decompressedDocumentUri(
  file: vscode.Uri,
  format: CompressionFormat,
): vscode.Uri {
  return vscode.Uri.from({
    scheme: DECOMPRESSED_SCHEME,
    path: withoutSuffix(format, file.path),
    query: file.toString(),
  });
}

/**
 * Supplies the text of the decompressed documents
 *
 * The custom editor decompresses a file before opening its document, to know
 * whether it can be shown at all, and hands the text over here so it is not
 * decompressed twice. A document VS Code opens on its own, restoring a window,
 * is decompressed here; if it cannot be shown its text says why.
 */
export class DecompressedDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  /** Text handed over by the editor, until VS Code asks for it */
  private readonly handedOver = new Map<string, string>();
  private readonly changes = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.changes.event;

  constructor(private readonly output: vscode.LogOutputChannel) {}

  /**
   * Show `text` as the document at `uri`, opening it or, if it is already
   * open, replacing what it showed
   */
  async show(
    uri: vscode.Uri,
    text: string,
    viewColumn: vscode.ViewColumn | undefined,
  ): Promise<void> {
    const key = uri.toString();
    this.handedOver.set(key, text);
    try {
      if (
        vscode.workspace.textDocuments.some((d) => d.uri.toString() === key)
      ) {
        this.changes.fire(uri);
      }
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document, {
        viewColumn,
        preview: false,
      });
    } catch (error) {
      this.handedOver.delete(key);
      throw error;
    }
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const key = uri.toString();
    const text = this.handedOver.get(key);
    if (text !== undefined) {
      this.handedOver.delete(key);
      return text;
    }

    const file = vscode.Uri.parse(uri.query, true);
    const fileName = path.basename(file.fsPath);
    const format = findFormat(file.fsPath);
    if (!format) {
      return `${fileName} is not a kind of file this extension can open.`;
    }
    try {
      const preview = await readPreview(format, file.fsPath, MAX_PREVIEW_BYTES);
      return preview.kind === 'text'
        ? preview.text
        : `${fileName} is more than ${MAX_PREVIEW_BYTES / 1024 / 1024} MB once decompressed, too large to show here. Open ${fileName} from the Explorer to decompress it to a file.`;
    } catch (error) {
      this.output.error(`Cannot show ${file.fsPath}: ${String(error)}`);
      return describeFailure(fileName, format, error);
    }
  }

  dispose(): void {
    this.changes.dispose();
  }
}
