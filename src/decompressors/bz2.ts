/**
 * bzip2 decompression
 *
 * Uses unbzip2-stream, which decodes one block at a time as input arrives,
 * decodes every concatenated stream, and reports input that ends before a
 * stream's end marker. The older 'bzip2' package lost data across blocks,
 * and seek-bzip needs the whole file in memory at once and accepts a file cut
 * short at a block boundary.
 */

import unbzip2Stream from 'unbzip2-stream';
import { ByteReader, asFailure, startsWith } from './chunks';
import { DecompressionFailure } from './failure';

/** Every bzip2 stream starts with "BZh" */
const BZIP2_MAGIC = Buffer.from('BZh');

/**
 * Decompress bzip2 data, every concatenated stream included
 *
 * pbzip2, and `cat a.bz2 b.bz2`, write several complete streams one after
 * another; the bzip2 tool decodes them all, so we do too.
 */
export async function* decompressBz2(
  compressed: AsyncIterable<Buffer>,
): AsyncGenerator<Buffer> {
  const reader = new ByteReader(compressed);
  try {
    if (!(await startsWith(reader, BZIP2_MAGIC))) {
      throw new DecompressionFailure(
        'not-this-format',
        'No bzip2 stream header',
      );
    }

    // The decoder does its work, and emits its output and errors, within
    // each write() and end() call, so a chunk is decoded only once the
    // previous one's output has been taken
    const decoder = unbzip2Stream();
    let decoded: Buffer[] = [];
    let failure: Error | undefined;
    decoder.on('data', (chunk: Buffer) => decoded.push(chunk));
    decoder.on('error', (error: Error) => (failure ??= error));

    const taken = function* () {
      if (failure) {
        throw failure;
      }
      const chunks = decoded;
      decoded = [];
      yield* chunks;
    };

    for await (const chunk of reader.rest()) {
      decoder.write(chunk);
      yield* taken();
    }
    decoder.end();
    yield* taken();
  } catch (error) {
    throw asFailure(error, () => 'damaged');
  } finally {
    await reader.close();
  }
}
