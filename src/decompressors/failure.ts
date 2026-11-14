/**
 * Why a compressed file could not be shown
 *
 * Every way decompression can fail is sorted into one of these reasons, so
 * the user is told what is wrong with the file in terms they can act on,
 * whichever library found the problem.
 */

export const FAILURE_REASONS = [
  /** The file has no bytes at all */
  'empty',
  /** The file could not be read from disk */
  'unreadable',
  /** The file's contents are not in the format its name says */
  'not-this-format',
  /** The data starts like the format but is corrupt or cut short */
  'damaged',
  /** The file decompressed, but a `.tar.*` file did not hold a tar archive */
  'not-a-tar-archive',
  /** The data is valid but was made with options the decoder cannot handle */
  'unsupported',
  /** The data is valid but the decoder could not get the memory it needs */
  'insufficient-memory',
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export class DecompressionFailure extends Error {
  constructor(
    readonly reason: FailureReason,
    detail: string,
    options?: { cause?: unknown },
  ) {
    super(detail, options);
    this.name = 'DecompressionFailure';
  }
}
