import { DecompressionFailure } from './decompressors/failure';
import { CompressionFormat } from './decompressors/formats';

/**
 * The sentence shown to the user when a file cannot be shown
 *
 * It names the file and says what is wrong with it in the user's terms. The
 * decoder's own wording, which is written for programmers, goes to the
 * output channel instead.
 */
export function describeFailure(
  fileName: string,
  format: CompressionFormat,
  error: unknown,
): string {
  if (!(error instanceof DecompressionFailure)) {
    return `${fileName} could not be opened because of an unexpected problem in this extension.`;
  }
  switch (error.reason) {
    case 'empty':
      return `${fileName} is empty, so there is nothing to show.`;
    case 'unreadable':
      return `${fileName} could not be read. ${whyUnreadable(error.cause)}`;
    case 'not-this-format':
      return `${fileName} is not a ${format.name} file. Its name ends in ${format.suffix}, but its contents are not ${format.name}-compressed.`;
    case 'damaged':
      return `${fileName} is damaged or incomplete, so it cannot be decompressed. It may have been cut short while it was being written or copied.`;
    case 'not-a-tar-archive':
      return `${fileName} was decompressed, but what is inside is not a tar archive, although its name says it is one.`;
    case 'unsupported':
      return `${fileName} was compressed with ${format.name} options that this extension cannot decompress.`;
    case 'insufficient-memory':
      return `${fileName} needs more memory to decompress than is available. Closing other programs may help.`;
  }
}

function whyUnreadable(cause: unknown): string {
  const code = (cause as { code?: unknown } | null)?.code;
  switch (code) {
    case 'ENOENT':
      return 'It no longer exists.';
    case 'EACCES':
    case 'EPERM':
      return 'You do not have permission to read it.';
    case 'EISDIR':
      return 'It is a folder, not a file.';
    default:
      return 'The system could not open it.';
  }
}
