import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProviderRegistry } from './providers/ProviderRegistry';
import { CompressedFileProvider } from './providers/CompressedFileProvider';
import { XZProvider } from './providers/XZProvider';
import { BZ2Provider } from './providers/BZ2Provider';

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024; // 50MB

/** Utility: close the custom editor tab for a given URI */
async function closeTabByUri(uri: vscode.Uri, viewType: string) {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input: any = tab.input;
      if (
        input?.viewType === viewType &&
        input?.uri?.toString?.() === uri.toString()
      ) {
        await vscode.window.tabGroups.close(tab);
        return;
      }
    }
  }
}

/** Utility: check if file exists */
async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Decompress to disk only; do not open the result */
async function handleLargeCompressedFile(
  filePath: string,
  registry: ProviderRegistry,
  currentTabUri?: vscode.Uri,
): Promise<boolean> {
  const provider = registry.getProvider(filePath);
  if (!provider) {
    vscode.window.showErrorMessage(`No provider found for file: ${path.basename(filePath)}`);
    return false;
  }

  try {
    // Decompress the file
    const decompressedData = await provider.decompressFile(filePath);
    
    // Use the provider's large file handler
    const handled = await provider.handleLargeFile(filePath, decompressedData, MAX_PREVIEW_BYTES, currentTabUri);
    
    if (handled && currentTabUri) {
      // Close the custom editor tab
      await closeTabByUri(currentTabUri, 'compressed-log-viewer.compressed');
    }
    
    return handled;
  } catch (error) {
    const errorMsg = `Failed to decompress ${provider.getFormat().name} file: ${error}`;
    vscode.window.showErrorMessage(errorMsg);
    return false;
  }
}

/** Extension entry */
export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Compressed Log Viewer');

  // Set up provider registry
  const registry = new ProviderRegistry();
  registry.register(new XZProvider());
  registry.register(new BZ2Provider());

  // Register text document content providers for all schemes
  const compressedFileProvider = new CompressedFileProvider(registry);
  for (const scheme of registry.getSchemes()) {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(scheme, compressedFileProvider)
    );
  }

  // Register custom editor
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('compressed-log-viewer.compressed', {
      async openCustomDocument(uri: vscode.Uri) {
        return { uri, dispose: () => {} };
      },

      async resolveCustomEditor(
        document: any,
        webviewPanel: vscode.WebviewPanel,
      ) {
        try {
          const filePath = document.uri.fsPath;
          const provider = registry.getProvider(filePath);

          if (!provider) {
            throw new Error(`No provider found for file: ${path.basename(filePath)}`);
          }

          // Decompress the file
          const decompressed = await provider.decompressFile(filePath);

          if (decompressed.length > MAX_PREVIEW_BYTES) {
            await handleLargeCompressedFile(filePath, registry, document.uri);
            return;
          }

          // Create virtual document URI
          const viewUri = provider.createVirtualUri(document.uri);
          const vdoc = await vscode.workspace.openTextDocument(viewUri);
          
          await vscode.window.showTextDocument(vdoc, {
            viewColumn: webviewPanel.viewColumn,
            preview: false,
          });
          
          await closeTabByUri(document.uri, 'compressed-log-viewer.compressed');
        } catch (err) {
          output.appendLine(`Failed to open compressed file: ${err}`);
          vscode.window.showErrorMessage(`Failed to open compressed file: ${err}`);
          await closeTabByUri(document.uri, 'compressed-log-viewer.compressed');
        }
      },
    }),
  );
}

export function deactivate() {}