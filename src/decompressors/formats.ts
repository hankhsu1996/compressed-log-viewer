/**
 * The compression formats the extension opens, and what is shared by all of them
 *
 * A format is a file-name suffix plus one function from a stream of
 * compressed chunks to a stream of decompressed chunks, so a file is never
 * held in memory whole. A tar archive of any format is named `.tar` followed
 * by that suffix, and its files are read out the same way whatever the
 * format.
 */

import * as fs from 'fs';
import { pipeline } from 'stream/promises';
import { decompressBz2 } from './bz2';
import { decompressXz } from './xz';
import { decompressZstd } from './zstd';
import { DecompressionFailure } from './failure';
import { tarFiles } from './tar';

export interface CompressionFormat {
  /** Name shown to the user, e.g. "XZ" */
  readonly name: string;
  /** Lower-case file-name suffix, e.g. ".xz"; its tar archives end in ".tar.xz" */
  readonly suffix: string;
  /**
   * The decompressed bytes of compressed chunks, every member of the data
   * included; fails with a DecompressionFailure, and passes on one from
   * `compressed` unchanged
   */
  decompress(compressed: AsyncIterable<Buffer>): AsyncIterable<Buffer>;
}

export const FORMATS: readonly CompressionFormat[] = [
  { name: 'XZ', suffix: '.xz', decompress: decompressXz },
  { name: 'bzip2', suffix: '.bz2', decompress: decompressBz2 },
  { name: 'Zstandard', suffix: '.zst', decompress: decompressZstd },
];

/**
 * The format a file name says the file is in, matched without regard to case
 */
export function findFormat(filePath: string): CompressionFormat | undefined {
  const lowerPath = filePath.toLowerCase();
  return FORMATS.find((format) => lowerPath.endsWith(format.suffix));
}

/**
 * Whether a file of this format is a compressed tar archive
 */
export function isTarArchive(
  format: CompressionFormat,
  filePath: string,
): boolean {
  return filePath.toLowerCase().endsWith(`.tar${format.suffix}`);
}

/**
 * A file's name or path without the format's suffix: `app.log.zst` is
 * `app.log` decompressed, and `logs.tar.zst` is `logs.tar`
 */
export function withoutSuffix(
  format: CompressionFormat,
  filePath: string,
): string {
  return filePath.slice(0, -format.suffix.length);
}

/**
 * The decompressed bytes of a file, read and decoded as they are consumed
 *
 * A file that cannot be shown fails with a DecompressionFailure, whose reason
 * says what is wrong with it.
 */
export function decompressedChunks(
  format: CompressionFormat,
  filePath: string,
): AsyncIterable<Buffer> {
  return format.decompress(fileChunks(filePath));
}

async function* fileChunks(filePath: string): AsyncGenerator<Buffer> {
  let empty = true;
  try {
    for await (const chunk of fs.createReadStream(filePath)) {
      empty = false;
      yield chunk as Buffer;
    }
  } catch (error) {
    throw new DecompressionFailure('unreadable', String(error), {
      cause: error,
    });
  }
  if (empty) {
    throw new DecompressionFailure('empty', 'The file has no bytes');
  }
}

/** What a file shows: its text, or that it is too large to show */
export type Preview =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'too-large' };

/**
 * The text of a file whose decompressed bytes number at most `limit`
 *
 * Decompression stops as soon as the limit is passed, so a large file costs
 * no more memory than a file of the limit's size. Aborting `signal` stops it
 * too, failing with the signal's reason.
 */
export async function readPreview(
  format: CompressionFormat,
  filePath: string,
  limit: number,
  signal?: AbortSignal,
): Promise<Preview> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of decompressedChunks(format, filePath)) {
    signal?.throwIfAborted();
    size += chunk.length;
    if (size > limit) {
      return { kind: 'too-large' };
    }
    chunks.push(chunk);
  }
  return {
    kind: 'text',
    text: await decompressedText(format, filePath, Buffer.concat(chunks)),
  };
}

/**
 * Write a file's decompressed bytes to `destination`, replacing it
 *
 * A failure to decompress is a DecompressionFailure; any other failure is the
 * file system's, from writing. Either way `destination` may be left partly
 * written. Aborting `signal` stops the work.
 */
export async function decompressToFile(
  format: CompressionFormat,
  filePath: string,
  destination: string,
  signal?: AbortSignal,
): Promise<void> {
  await pipeline(
    decompressedChunks(format, filePath),
    fs.createWriteStream(destination),
    { signal },
  );
}

/**
 * The text to show for a file's decompressed bytes: the bytes themselves read
 * as UTF-8 or, for a tar archive, the files inside it
 *
 * An archive's files are shown the way `head` shows several files, each
 * after a `==> name <==` line, so where one ends and the next begins can be
 * seen; an archive of one file shows just that file.
 */
async function decompressedText(
  format: CompressionFormat,
  filePath: string,
  decompressed: Buffer,
): Promise<string> {
  if (!isTarArchive(format, filePath)) {
    return decompressed.toString('utf8');
  }
  const files = await tarFiles(decompressed);
  if (files.length === 1) {
    return files[0].content.toString('utf8');
  }
  return files
    .map(
      (file, index) =>
        `${index === 0 ? '' : '\n'}==> ${file.name} <==\n${file.content.toString('utf8')}`,
    )
    .join('');
}
