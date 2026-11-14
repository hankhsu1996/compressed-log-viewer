/**
 * Reference compressors for testing
 *
 * Each format's fixtures are made by an implementation other than the
 * decoder under test where one exists (the system xz and bzip2 tools), so a
 * decoder bug cannot cancel out against an encoder bug. Zstandard fixtures
 * come from Node's bundled libzstd, the reference implementation the zstd
 * command-line tool also wraps.
 *
 * A missing tool fails the tests that need it rather than skipping them, so a
 * green run always means every format was tested.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { CompressionFormat } from '../../decompressors/formats';

const MAX_BUFFER = 200 * 1024 * 1024;

/**
 * Run a system tool the tests rely on, saying which one when it is missing
 */
export function runTool(
  tool: string,
  args: string[],
  input?: Buffer | string,
): Buffer {
  try {
    return execFileSync(tool, args, { input, maxBuffer: MAX_BUFFER });
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ENOENT') {
      throw new Error(`These tests need the '${tool}' command; install it`, {
        cause: error,
      });
    }
    throw error;
  }
}

const REFERENCE_COMPRESSORS: Record<string, (data: Buffer) => Buffer> = {
  '.xz': (data) => runTool('xz', ['-c'], data),
  '.bz2': (data) => runTool('bzip2', ['-c'], data),
  // With a content checksum, as the zstd command-line tool writes by default
  '.zst': (data) =>
    zlib.zstdCompressSync(data, {
      params: { [zlib.constants.ZSTD_c_checksumFlag]: 1 },
    }),
};

/**
 * A function compressing bytes into one complete member of `format`
 */
export function referenceCompressor(
  format: CompressionFormat,
): (data: Buffer) => Buffer {
  const compress = REFERENCE_COMPRESSORS[format.suffix];
  if (!compress) {
    throw new Error(`No reference compressor for ${format.suffix}`);
  }
  return compress;
}

/**
 * Build an uncompressed tar archive of the given files, in the given order,
 * using the system tar
 */
export function tarOf(files: Record<string, Buffer | string>): Buffer {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'compressed-log-viewer-tar-'),
  );
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    return runTool('tar', ['-cf', '-', '-C', dir, ...Object.keys(files)]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
