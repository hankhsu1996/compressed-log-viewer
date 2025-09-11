import * as vscode from 'vscode';

/**
 * Configuration for a compression format
 */
export interface CompressionFormat {
  /** Format name for display (e.g., "XZ", "bzip2") */
  name: string;
  /** File extensions supported (e.g., ['.xz', '.tar.xz']) */
  extensions: string[];
  /** URI scheme for virtual documents (e.g., 'xz-view') */
  scheme: string;
}

/**
 * Abstract base class for compression providers
 */
export abstract class CompressionProvider {
  protected format: CompressionFormat;

  constructor(format: CompressionFormat) {
    this.format = format;
  }

  /**
   * Get format configuration
   */
  getFormat(): CompressionFormat {
    return this.format;
  }

  /**
   * Check if this provider supports the given file path
   */
  supportsFile(filePath: string): boolean {
    return this.format.extensions.some((ext) =>
      filePath.toLowerCase().endsWith(ext),
    );
  }

  /**
   * Decompress a file to Buffer
   */
  abstract decompressFile(filePath: string): Promise<Buffer>;

  /**
   * Convert decompressed buffer to text content
   * Handles both regular compressed files and tar archives
   */
  abstract bufferToText(buffer: Buffer, filePath: string): Promise<string>;

  /**
   * Provide text document content for virtual URI
   * This is the main method called by VS Code's TextDocumentContentProvider
   */
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    try {
      // Extract original file path from virtual URI
      const filePath = this.extractFilePath(uri);

      // Decompress the file
      const decompressedBuffer = await this.decompressFile(filePath);

      // Convert to text content
      return await this.bufferToText(decompressedBuffer, filePath);
    } catch (error) {
      const errorMessage = `Error processing ${this.format.name} file: ${error}`;
      vscode.window.showErrorMessage(errorMessage);
      return errorMessage;
    }
  }

  /**
   * Extract the original file path from a virtual URI
   * Default implementation removes the scheme-specific suffix
   */
  protected extractFilePath(uri: vscode.Uri): string {
    return uri.fsPath.replace(
      new RegExp(`\\.${this.format.scheme.replace('-', '\\-')}$`),
      '',
    );
  }

  /**
   * Create virtual URI for the given file path
   */
  createVirtualUri(originalUri: vscode.Uri): vscode.Uri {
    return originalUri.with({
      scheme: this.format.scheme,
      path: originalUri.path + `.${this.format.scheme}`,
    });
  }

  /**
   * Handle large files by prompting user and optionally writing to disk
   */
  async handleLargeFile(
    filePath: string,
    decompressedData: Buffer,
    _maxSize: number,
    _currentTabUri?: vscode.Uri,
  ): Promise<boolean> {
    // Build output path by removing the compression extension
    const outputPath = this.getDecompressedPath(filePath);
    const fileName = require('path').basename(outputPath);
    const sizeMB = Math.round(decompressedData.length / 1024 / 1024);

    // Ask user
    const choice = await vscode.window.showWarningMessage(
      `This file is too large to preview (${sizeMB}MB). Do you want to decompress it to ${fileName}?`,
      'Decompress',
      'Cancel',
    );

    if (choice !== 'Decompress') {
      return false;
    }

    // Check if output file already exists
    try {
      const fs = require('fs');
      await fs.promises.access(outputPath);
      const overwrite = await vscode.window.showWarningMessage(
        `File ${fileName} already exists. Overwrite?`,
        'Overwrite',
        'Cancel',
      );
      if (overwrite !== 'Overwrite') {
        return false;
      }
    } catch {
      // File doesn't exist, proceed
    }

    // Write decompressed data to disk
    const fs = require('fs');
    await fs.promises.writeFile(outputPath, decompressedData);

    // Inform user
    vscode.window.showInformationMessage(`Decompressed to ${fileName}.`);

    return true;
  }

  /**
   * Get the path where the decompressed file should be written
   * Default implementation removes the last compression extension
   */
  protected getDecompressedPath(filePath: string): string {
    for (const ext of this.format.extensions) {
      if (filePath.endsWith(ext)) {
        return filePath.slice(0, -ext.length);
      }
    }
    return filePath + '.decompressed';
  }
}
