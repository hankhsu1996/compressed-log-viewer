/**
 * Pure BZ2 decompression logic (no VS Code dependency)
 *
 * Uses seek-bzip library which correctly handles multi-block bzip2 files.
 * The older 'bzip2' npm package has bugs with multi-block decompression.
 */

import * as fs from 'fs';
import * as seekBzip from 'seek-bzip';
import { extractTarContent } from './tar';

/**
 * Decompress a BZ2 file to Buffer
 */
export async function decompressBz2File(filePath: string): Promise<Buffer> {
  const compressed = await fs.promises.readFile(filePath);
  return decompressBz2Buffer(compressed);
}

/**
 * Decompress BZ2 data from a Buffer
 */
export function decompressBz2Buffer(compressed: Buffer): Buffer {
  const decompressed = seekBzip.decode(compressed);
  return Buffer.from(decompressed);
}

/**
 * Convert decompressed buffer to text
 * Handles both regular .bz2 files and .tar.bz2 archives
 */
export async function bz2BufferToText(
  buffer: Buffer,
  filePath: string,
): Promise<string> {
  if (filePath.endsWith('.tar.bz2')) {
    return extractTarContent(buffer);
  }
  return buffer.toString('utf8');
}
