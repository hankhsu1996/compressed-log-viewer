/**
 * XZ decompression
 */

import * as lzma from 'lzma-native';
import { ByteReader, asFailure, startsWith, transformed } from './chunks';
import { DecompressionFailure, FailureReason } from './failure';

/** Every XZ stream starts with these six bytes */
const XZ_MAGIC = Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]);

/** liblzma's errors for valid data it cannot decode, and why it cannot */
const VALID_DATA_ERRORS = new Map<string, FailureReason>([
  ['LZMA_OPTIONS_ERROR', 'unsupported'],
  ['LZMA_MEM_ERROR', 'insufficient-memory'],
]);

/**
 * Decompress XZ data, every concatenated stream included
 */
export async function* decompressXz(
  compressed: AsyncIterable<Buffer>,
): AsyncGenerator<Buffer> {
  const reader = new ByteReader(compressed);
  try {
    if (!(await startsWith(reader, XZ_MAGIC))) {
      throw new DecompressionFailure('not-this-format', 'No XZ stream header');
    }
    // liblzma itself walks concatenated streams, and so checks the padding
    // between them (XZ file format, section 2.2)
    yield* transformed(
      reader.rest(),
      lzma.createDecompressor({ flags: lzma.CONCATENATED }),
    );
  } catch (error) {
    throw asFailure(error, reasonFor);
  } finally {
    await reader.close();
  }
}

function reasonFor(error: unknown): FailureReason {
  const name = error instanceof Error ? error.name : '';
  return VALID_DATA_ERRORS.get(name) ?? 'damaged';
}
