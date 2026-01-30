import { CompressionProvider, CompressionFormat } from './CompressionProvider';
import { decompressXzFile, xzBufferToText } from '../decompressors/xz';

/**
 * XZ compression provider supporting .xz and .tar.xz files
 */
export class XZProvider extends CompressionProvider {
  constructor() {
    const format: CompressionFormat = {
      name: 'XZ',
      extensions: ['.xz', '.tar.xz'],
      scheme: 'xz-view',
    };
    super(format);
  }

  /**
   * Decompress an XZ file to Buffer
   */
  async decompressFile(filePath: string): Promise<Buffer> {
    return decompressXzFile(filePath);
  }

  /**
   * Convert decompressed buffer to text content
   */
  async bufferToText(buffer: Buffer, filePath: string): Promise<string> {
    return xzBufferToText(buffer, filePath);
  }
}
