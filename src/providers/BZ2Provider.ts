import * as fs from 'fs';
import * as bzip2 from 'bzip2';
import * as tar from 'tar-stream';
import { CompressionProvider, CompressionFormat } from './CompressionProvider';

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
   * Decompress a BZ2 file to Buffer using bzip2 library
   */
  async decompressFile(filePath: string): Promise<Buffer> {
    const compressed = await fs.promises.readFile(filePath);

    // Convert Buffer to Uint8Array for bzip2 library
    const uint8Array = new Uint8Array(compressed);

    // Create bit reader
    const bitstream = bzip2.array(uint8Array);

    // Decompress using simple method (handles header + decompression)
    const decompressed = bzip2.simple(bitstream);

    // Convert string result back to Buffer
    return Buffer.from(decompressed, 'binary');
  }

  /**
   * Convert decompressed buffer to text content
   * Handles both regular .bz2 files and .tar.bz2 archives
   */
  async bufferToText(buffer: Buffer, filePath: string): Promise<string> {
    // For regular .bz2 files, just convert buffer to UTF-8 string
    if (!filePath.endsWith('.tar.bz2')) {
      return buffer.toString('utf8');
    }

    // For .tar.bz2 files, extract all entries and concatenate their content
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
