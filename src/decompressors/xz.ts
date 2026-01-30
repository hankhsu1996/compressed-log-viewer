/**
 * Pure XZ decompression logic (no VS Code dependency)
 */

import * as fs from 'fs';
import * as lzma from 'lzma-native';
import { extractTarContent } from './tar';

/**
 * Decompress an XZ file to Buffer
 */
export async function decompressXzFile(filePath: string): Promise<Buffer> {
  const compressed = await fs.promises.readFile(filePath);
  return decompressXzBuffer(compressed);
}

/**
 * Decompress XZ data from a Buffer
 */
export async function decompressXzBuffer(compressed: Buffer): Promise<Buffer> {
  return await lzma.decompress(compressed);
}

/**
 * Convert decompressed buffer to text
 * Handles both regular .xz files and .tar.xz archives
 */
export async function xzBufferToText(
  buffer: Buffer,
  filePath: string,
): Promise<string> {
  if (filePath.endsWith('.tar.xz')) {
    return extractTarContent(buffer);
  }
  return buffer.toString('utf8');
}
