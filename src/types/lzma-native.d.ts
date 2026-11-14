declare module 'lzma-native' {
  import { Transform } from 'stream';

  /** Decode every concatenated stream, checking the padding between them */
  export const CONCATENATED: number;

  /** A transform from .xz (or .lzma) bytes to the bytes they compress */
  export function createDecompressor(options?: { flags?: number }): Transform;
}
