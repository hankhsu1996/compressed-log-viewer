import * as vscode from 'vscode';
import {
  DECOMPRESSED_SCHEME,
  DecompressedDocumentProvider,
} from './providers/DecompressedDocumentProvider';
import { CompressedFileEditorProvider } from './providers/CompressedFileEditorProvider';

/** Extension entry */
export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Compressed Log Viewer', {
    log: true,
  });
  const documents = new DecompressedDocumentProvider(output);

  context.subscriptions.push(
    output,
    documents,
    vscode.workspace.registerTextDocumentContentProvider(
      DECOMPRESSED_SCHEME,
      documents,
    ),
    vscode.window.registerCustomEditorProvider(
      CompressedFileEditorProvider.viewType,
      new CompressedFileEditorProvider(documents, output),
    ),
  );
}

export function deactivate() {}
