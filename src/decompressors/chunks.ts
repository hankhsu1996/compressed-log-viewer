/**
 * Helpers for decoders that turn a stream of byte chunks into another
 */

import { Duplex, Readable, pipeline } from 'stream';
import { DecompressionFailure } from './failure';

/**
 * Reads a stream of byte chunks a chosen number of bytes at a time
 */
export class ByteReader {
  private readonly chunks: AsyncIterator<Buffer>;
  private pending: Buffer = Buffer.alloc(0);
  private ended = false;

  constructor(source: AsyncIterable<Buffer>) {
    this.chunks = source[Symbol.asyncIterator]();
  }

  /** The next `length` bytes without consuming them; fewer at the end */
  async peek(length: number): Promise<Buffer> {
    await this.fill(length);
    return this.pending.subarray(0, length);
  }

  async atEnd(): Promise<boolean> {
    await this.fill(1);
    return this.pending.length === 0;
  }

  /** The next `length` bytes; the data is damaged if it ends first */
  async read(length: number): Promise<Buffer> {
    await this.fill(length);
    if (this.pending.length < length) {
      throw truncated();
    }
    return this.take(length);
  }

  /** The next `length` bytes in pieces as they arrive; damaged if they end first */
  async *pieces(length: number): AsyncGenerator<Buffer> {
    for (let left = length; left > 0; ) {
      const piece = await this.nextPiece(left);
      left -= piece.length;
      yield piece;
    }
  }

  /** Read past the next `length` bytes; damaged if they end first */
  async skip(length: number): Promise<void> {
    for (let left = length; left > 0; ) {
      left -= (await this.nextPiece(left)).length;
    }
  }

  /** Every byte not yet read */
  async *rest(): AsyncGenerator<Buffer> {
    while (!(await this.atEnd())) {
      yield this.take(this.pending.length);
    }
  }

  /** Stop reading the source, so whatever it reads from is released */
  async close(): Promise<void> {
    await this.chunks.return?.();
  }

  private async fill(length: number): Promise<void> {
    while (this.pending.length < length && !this.ended) {
      const next = await this.chunks.next();
      if (next.done) {
        this.ended = true;
      } else {
        this.pending =
          this.pending.length === 0
            ? next.value
            : Buffer.concat([this.pending, next.value]);
      }
    }
  }

  /** Up to `limit` of the next bytes, as many as have arrived */
  private async nextPiece(limit: number): Promise<Buffer> {
    if (await this.atEnd()) {
      throw truncated();
    }
    return this.take(Math.min(limit, this.pending.length));
  }

  private take(length: number): Buffer {
    const bytes = this.pending.subarray(0, length);
    this.pending = this.pending.subarray(length);
    return bytes;
  }
}

function truncated(): DecompressionFailure {
  return new DecompressionFailure('damaged', 'The data ends partway through');
}

/**
 * The output of a Node transform stream fed with `source`
 *
 * Stopping the iteration early destroys the transform and stops reading the
 * source; an error from either ends the iteration with that error.
 */
export async function* transformed(
  source: AsyncIterable<Buffer>,
  transform: Duplex,
): AsyncGenerator<Buffer> {
  const output = pipeline(Readable.from(source), transform, () => {});
  for await (const chunk of output) {
    yield chunk as Buffer;
  }
}

/**
 * Whether bytes begin with `magic`, reading no further than its length
 */
export async function startsWith(
  reader: ByteReader,
  magic: Buffer,
): Promise<boolean> {
  return (await reader.peek(magic.length)).equals(magic);
}

/**
 * `error` as a DecompressionFailure: unchanged if it already is one, which
 * is how a failure from the file read passes through a decoder, otherwise
 * sorted by `reasonFor`
 */
export function asFailure(
  error: unknown,
  reasonFor: (error: unknown) => DecompressionFailure['reason'],
): DecompressionFailure {
  return error instanceof DecompressionFailure
    ? error
    : new DecompressionFailure(reasonFor(error), String(error), {
        cause: error,
      });
}
