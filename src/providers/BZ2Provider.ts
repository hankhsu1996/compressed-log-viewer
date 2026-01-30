import { CompressionProvider, CompressionFormat } from './CompressionProvider';
import {
  decompressBz2File,
  bz2BufferToText,
} from '../decompressors/bz2';

/**
 * BZ2 compression provider supporting .bz2 and .tar.bz2 files
 */
export class BZ2Provider extends CompressionProvider {
  constructor() {
    const format: CompressionFormat = {
      name: 'bzip2',
      extensions: ['.bz2', '.tar.bz2'],
      scheme: 'bz2-view',
    };
    super(format);
  }

  /**
   * Decompress a BZ2 file to Buffer
   */
  async decompressFile(filePath: string): Promise<Buffer> {
    return decompressBz2File(filePath);
  }

  /**
   * Convert decompressed buffer to text content
   */
  async bufferToText(buffer: Buffer, filePath: string): Promise<string> {
    return bz2BufferToText(buffer, filePath);
  }
}
