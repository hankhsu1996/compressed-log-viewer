/**
 * Reading the files out of a tar archive
 */

import * as tar from 'tar-stream';
import { DecompressionFailure } from './failure';

export interface TarFile {
  readonly name: string;
  readonly content: Buffer;
}

/**
 * The regular files of a tar archive, in archive order
 *
 * Bytes that do not begin with a tar header are not a tar archive; an archive
 * that ends partway through, after at least one header, is damaged.
 */
export async function tarFiles(archive: Buffer): Promise<TarFile[]> {
  const extract = tar.extract();
  extract.end(archive);

  const files: TarFile[] = [];
  let sawHeader = false;
  try {
    for await (const entry of extract) {
      sawHeader = true;
      const chunks: Buffer[] = [];
      for await (const chunk of entry) {
        chunks.push(chunk);
      }
      // Only these entry types hold a file's bytes; directories and links
      // hold none
      const type = entry.header.type;
      if (type === 'file' || type === 'contiguous-file') {
        files.push({ name: entry.header.name, content: Buffer.concat(chunks) });
      }
    }
  } catch (error) {
    throw new DecompressionFailure(
      sawHeader ? 'damaged' : 'not-a-tar-archive',
      String(error),
      { cause: error },
    );
  }
  return files;
}
