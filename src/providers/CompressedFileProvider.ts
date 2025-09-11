import * as vscode from 'vscode';
import { ProviderRegistry } from './ProviderRegistry';

/**
 * Main text document content provider for all compressed file formats
 * Delegates to specific compression providers via the registry
 */
export class CompressedFileProvider
  implements vscode.TextDocumentContentProvider
{
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  private registry: ProviderRegistry;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  /**
   * Provide text document content for compressed files
   * Determines the appropriate provider based on the URI scheme and delegates
   */
  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    // Find the appropriate provider based on the URI scheme
    const provider = this.findProviderByScheme(uri.scheme);

    if (!provider) {
      const errorMsg = `No provider found for scheme: ${uri.scheme}`;
      vscode.window.showErrorMessage(errorMsg);
      return errorMsg;
    }

    // Delegate to the specific provider
    return await provider.provideTextDocumentContent(uri);
  }

  /**
   * Find provider by URI scheme
   */
  private findProviderByScheme(scheme: string): any {
    const providers = this.registry.getAllProviders();
    return providers.find((provider) => provider.getFormat().scheme === scheme);
  }

  /**
   * Refresh content for a given URI
   */
  public refresh(uri: vscode.Uri): void {
    this._onDidChange.fire(uri);
  }
}
