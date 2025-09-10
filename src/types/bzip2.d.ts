declare module 'bzip2' {
  /**
   * Create a bit reader function from a Uint8Array
   */
  export function array(data: Uint8Array): () => number;

  /**
   * Read bzip2 file header and return block size (1-9)
   */
  export function header(bitstream: () => number): number;

  /**
   * Decompress a single block
   * @param bitstream - bit reader function from array()
   * @param blockSize - block size from header()
   * @param maxLength - optional max output length
   * @returns decompressed string or -1 if final block
   */
  export function decompress(
    bitstream: () => number, 
    blockSize: number, 
    maxLength?: number
  ): string | -1;

  /**
   * Decompress entire file (combines header + decompress)
   * @param bitstream - bit reader function from array()
   * @returns decompressed string
   */
  export function simple(bitstream: () => number): string;
}