import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  CompressionFormat,
  decompressToFile,
  findFormat,
  readPreview,
  withoutSuffix,
} from '../decompressors/formats';
import { DecompressionFailure } from '../decompressors/failure';
import { describeFailure } from '../failureMessages';
import {
  DecompressedDocumentProvider,
  MAX_PREVIEW_BYTES,
  decompressedDocumentUri,
} from './DecompressedDocumentProvider';
import { showPage } from './editorPage';

/**
 * The custom editor VS Code opens for a compressed file
 *
 * When the file can be shown it is replaced by a read-only text document of
 * its contents. When it cannot, the editor stays open and says why, with the
 * things the user can do about it, in place of the text. Closing the editor
 * stops whatever it was doing.
 */
export class CompressedFileEditorProvider
  implements vscode.CustomReadonlyEditorProvider
{
  static readonly viewType = 'compressed-log-viewer.compressed';

  constructor(
    private readonly documents: DecompressedDocumentProvider,
    private readonly output: vscode.LogOutputChannel,
  ) {}

  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => {} };
  }

  resolveCustomEditor(
    document: vscode.CustomDocument,
    panel: vscode.WebviewPanel,
  ): void {
    // Resolve at once, so the editor shows its progress page while the file
    // is decompressed, and may be closed then
    void this.open(document.uri, new EditorPanel(panel, this.output));
  }

  private async open(file: vscode.Uri, editor: EditorPanel): Promise<void> {
    const fileName = path.basename(file.fsPath);
    const format = findFormat(file.fsPath);
    if (!format) {
      editor.present({
        heading: `Cannot show ${fileName}`,
        message: `${fileName} is not a kind of file this extension can open.`,
        actions: [],
      });
      return;
    }

    editor.present({
      heading: `Decompressing ${fileName}…`,
      message: '',
      actions: [],
    });
    try {
      const preview = await readPreview(
        format,
        file.fsPath,
        MAX_PREVIEW_BYTES,
        editor.signal,
      );
      if (editor.closed) {
        return;
      }
      if (preview.kind === 'too-large') {
        this.showTooLarge(editor, file, format);
        return;
      }
      await this.documents.show(
        decompressedDocumentUri(file, format),
        preview.text,
        editor.viewColumn,
      );
      editor.close();
    } catch (error) {
      if (!editor.closed) {
        this.showFailure(editor, file, format, error);
      }
    }
  }

  private showFailure(
    editor: EditorPanel,
    file: vscode.Uri,
    format: CompressionFormat,
    error: unknown,
  ): void {
    this.output.error(`Cannot show ${file.fsPath}: ${String(error)}`);
    const fileName = path.basename(file.fsPath);
    const notThisFormat =
      error instanceof DecompressionFailure &&
      error.reason === 'not-this-format';
    const plainText: Action[] = notThisFormat
      ? [
          {
            label: 'Open as Plain Text',
            run: () =>
              vscode.commands.executeCommand(
                'vscode.openWith',
                file,
                'default',
              ),
          },
        ]
      : [];

    editor.present({
      heading: `Cannot show ${fileName}`,
      message: describeFailure(fileName, format, error),
      actions: [...plainText, this.showDetails()],
    });
  }

  private showTooLarge(
    editor: EditorPanel,
    file: vscode.Uri,
    format: CompressionFormat,
  ): void {
    const fileName = path.basename(file.fsPath);
    const target = withoutSuffix(format, file.fsPath);

    editor.present({
      heading: `${fileName} is too large to preview`,
      message: `${fileName} is more than ${MAX_PREVIEW_BYTES / 1024 / 1024} MB once decompressed, more than this editor previews. You can decompress it to a file instead.`,
      actions: [
        {
          label: `Decompress to ${path.basename(target)}`,
          run: () => this.save(editor, file, format, target, false),
        },
        {
          label: 'Save As…',
          run: () => this.saveAs(editor, file, format, target),
        },
      ],
    });
  }

  private async saveAs(
    editor: EditorPanel,
    file: vscode.Uri,
    format: CompressionFormat,
    suggested: string,
  ): Promise<void> {
    const destination = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(suggested),
      title: 'Save decompressed file as',
    });
    // The save dialog itself asks before replacing a file
    if (destination) {
      await this.save(editor, file, format, destination.fsPath, true);
    }
  }

  /**
   * Decompress `file` to `destination`
   *
   * The bytes go to a hidden file beside the destination, which takes the
   * destination's name only once it is complete, so a failure or a closed
   * editor leaves no half-written file. Replacing a file is confirmed before
   * starting, and again at the end if one has appeared in the meantime.
   */
  private async save(
    editor: EditorPanel,
    file: vscode.Uri,
    format: CompressionFormat,
    destination: string,
    replaceConfirmed: boolean,
  ): Promise<void> {
    const mayReplace = async (): Promise<boolean> => {
      if (!replaceConfirmed && (await exists(destination))) {
        replaceConfirmed = await confirmReplace(destination);
        return replaceConfirmed;
      }
      return true;
    };

    if (!(await mayReplace())) {
      return;
    }

    const fileName = path.basename(file.fsPath);
    const destinationName = path.basename(destination);
    editor.present({
      heading: `Decompressing ${fileName} to ${destinationName}…`,
      message: '',
      actions: [],
    });

    const staging = path.join(
      path.dirname(destination),
      `.${destinationName}.${randomBytes(4).toString('hex')}.partial`,
    );
    try {
      await decompressToFile(format, file.fsPath, staging, editor.signal);
      if (!(await mayReplace())) {
        await fs.promises.rm(staging, { force: true });
        this.showTooLarge(editor, file, format);
        return;
      }
      await fs.promises.rename(staging, destination);
    } catch (error) {
      await fs.promises.rm(staging, { force: true });
      if (!editor.closed) {
        this.showSaveFailure(editor, file, format, destination, error);
      }
      return;
    }

    const saved = vscode.Uri.file(destination);
    editor.present({
      heading: `Decompressed to ${destinationName}`,
      message: `The contents of ${fileName} are now in ${destination}.`,
      actions: [
        {
          label: `Open ${destinationName}`,
          run: () => vscode.commands.executeCommand('vscode.open', saved),
        },
        {
          label: 'Show in Folder',
          run: () => vscode.commands.executeCommand('revealFileInOS', saved),
        },
      ],
    });
  }

  private showSaveFailure(
    editor: EditorPanel,
    file: vscode.Uri,
    format: CompressionFormat,
    destination: string,
    error: unknown,
  ): void {
    this.output.error(`Cannot write ${destination}: ${String(error)}`);
    const fileName = path.basename(file.fsPath);
    const message =
      error instanceof DecompressionFailure
        ? describeFailure(fileName, format, error)
        : `${path.basename(destination)} could not be written. ${whyUnwritable(error)}`;
    editor.present({
      heading: `Cannot decompress ${fileName}`,
      message,
      actions: [
        {
          label: 'Save Somewhere Else…',
          run: () => this.saveAs(editor, file, format, destination),
        },
        this.showDetails(),
      ],
    });
  }

  private showDetails(): Action {
    return { label: 'Show Details', run: () => this.output.show() };
  }
}

/** A button on an editor's page, and what clicking it does */
interface Action {
  readonly label: string;
  run(): unknown;
}

interface PanelContent {
  readonly heading: string;
  readonly message: string;
  readonly actions: readonly Action[];
}

/**
 * The page a custom editor shows, and what each of its buttons does
 *
 * One click is acted on at a time: clicks while an action runs are ignored,
 * so a double click does not start the same work twice.
 */
class EditorPanel {
  private actions: readonly Action[] = [];
  private running = false;
  private readonly disposed = new AbortController();

  constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly output: vscode.LogOutputChannel,
  ) {
    panel.webview.options = { enableScripts: true };
    panel.onDidDispose(() => this.disposed.abort());
    panel.webview.onDidReceiveMessage((message: { action?: unknown }) =>
      this.run(message.action),
    );
  }

  /** Aborted once the editor is closed */
  get signal(): AbortSignal {
    return this.disposed.signal;
  }

  get closed(): boolean {
    return this.disposed.signal.aborted;
  }

  get viewColumn(): vscode.ViewColumn | undefined {
    return this.panel.viewColumn;
  }

  present(content: PanelContent): void {
    if (this.closed) {
      return;
    }
    this.actions = content.actions;
    showPage(this.panel.webview, {
      heading: content.heading,
      message: content.message,
      actions: content.actions.map((action, index) => ({
        id: String(index),
        label: action.label,
      })),
    });
  }

  close(): void {
    this.panel.dispose();
  }

  private async run(id: unknown): Promise<void> {
    const action =
      typeof id === 'string' ? this.actions[Number(id)] : undefined;
    if (!action || this.running) {
      return;
    }
    this.running = true;
    try {
      await action.run();
    } catch (error) {
      this.output.error(`${action.label} failed: ${String(error)}`);
      this.present({
        heading: `${action.label} failed`,
        message:
          'It could not be completed because of an unexpected problem in this extension.',
        actions: [{ label: 'Show Details', run: () => this.output.show() }],
      });
    } finally {
      this.running = false;
    }
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the user agrees to replace the existing file at `target`
 */
async function confirmReplace(target: string): Promise<boolean> {
  const replace = 'Replace';
  const choice = await vscode.window.showWarningMessage(
    `${path.basename(target)} already exists in this folder. Replace it?`,
    { modal: true },
    replace,
  );
  return choice === replace;
}

function whyUnwritable(error: unknown): string {
  switch ((error as { code?: unknown } | null)?.code) {
    case 'EACCES':
    case 'EPERM':
      return 'You do not have permission to write there.';
    case 'ENOENT':
      return 'The folder no longer exists.';
    case 'ENOSPC':
      return 'The disk is full.';
    case 'EROFS':
      return 'The disk is read-only.';
    default:
      return 'The system could not write it.';
  }
}
