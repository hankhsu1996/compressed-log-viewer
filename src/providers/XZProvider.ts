import * as fs from 'fs';
import * as lzma from 'lzma-native';
import * as tar from 'tar-stream';
import { CompressionProvider, CompressionFormat } from './CompressionProvider';

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
   * Decompress an XZ file to Buffer using lzma-native
   */
  async decompressFile(filePath: string): Promise<Buffer> {
    const compressed = await fs.promises.readFile(filePath);
    return await lzma.decompress(compressed);
  }

  /**
   * Convert decompressed buffer to text content
   * Handles both regular .xz files and .tar.xz archives
   */
  async bufferToText(buffer: Buffer, filePath: string): Promise<string> {
    // For regular .xz files, just convert buffer to UTF-8 string
    if (!filePath.endsWith('.tar.xz')) {
      return buffer.toString('utf8');
    }

    // For .tar.xz files, extract all entries and concatenate their content
    const extract = tar.extract();
    let content = '';

    return new Promise<string>((resolve, reject) => {
      extract.on('entry', (_header: any, stream: any, next: () => void) => {
        const chunks: Buffer[] = [];
        
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        
        stream.on('end', () => {
          content += Buffer.concat(chunks).toString('utf8');
          next();
        });
        
        stream.resume();
      });

      extract.on('finish', () => resolve(content));
      extract.on('error', reject);
      
      // Feed the decompressed buffer to the tar extractor
      extract.end(buffer);
    });
  }
}