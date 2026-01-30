/**
 * TAR archive extraction utilities
 */

import * as tar from 'tar-stream';

/**
 * Extract text content from a tar archive buffer
 * Concatenates content from all entries
 */
export async function extractTarContent(buffer: Buffer): Promise<string> {
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

    extract.end(buffer);
  });
}
