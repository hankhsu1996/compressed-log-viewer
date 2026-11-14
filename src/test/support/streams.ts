/**
 * Feeding decoders and reading what they produce
 */

/**
 * `data` as a stream of chunks of `size` bytes, counting how many the
 * consumer has pulled
 */
export function chunked(
  data: Buffer,
  size = 64 * 1024,
): AsyncIterable<Buffer> & { readonly pulled: number; readonly total: number } {
  const source = {
    pulled: 0,
    total: Math.ceil(data.length / size),
    async *[Symbol.asyncIterator]() {
      for (let offset = 0; offset < data.length; offset += size) {
        // Each chunk arrives on a later turn of the event loop, as from a file
        await new Promise(setImmediate);
        source.pulled++;
        yield data.subarray(offset, offset + size);
      }
    },
  };
  return source;
}

/**
 * Every byte of a stream of chunks, joined
 */
export async function collect(chunks: AsyncIterable<Buffer>): Promise<Buffer> {
  const all: Buffer[] = [];
  for await (const chunk of chunks) {
    all.push(chunk);
  }
  return Buffer.concat(all);
}

/**
 * What `decode` makes of `data`, given to it in one chunk
 */
export function decodeWhole(
  decode: (compressed: AsyncIterable<Buffer>) => AsyncIterable<Buffer>,
  data: Buffer,
): Promise<Buffer> {
  return collect(decode(chunked(data, Math.max(data.length, 1))));
}
