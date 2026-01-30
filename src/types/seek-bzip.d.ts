declare module 'seek-bzip' {
  /**
   * Decode bzip2 compressed data
   * @param compressed - Buffer or Uint8Array of compressed data
   * @returns Uint8Array of decompressed data
   */
  export function decode(compressed: Buffer | Uint8Array): Uint8Array;

  /**
   * Decode a single bzip2 block at a specific bit offset
   */
  export function decodeBlock(
    compressed: Buffer | Uint8Array,
    bitOffset: number,
  ): Uint8Array;
}
