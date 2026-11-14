/**
 * Zstandard decompression
 *
 * Zstandard data is a sequence of frames, and its content is the content of
 * every data frame in order, skippable frames contributing nothing (RFC 8878,
 * section 3). Node's decoder stops after the first frame, and ends a
 * truncated frame without an error, so the frames are walked here: each data
 * frame is handed to its own Node decoder, and data that ends partway through
 * a frame is reported as damaged.
 */

import * as zlib from 'zlib';
import { ByteReader, asFailure, transformed } from './chunks';
import { DecompressionFailure, FailureReason } from './failure';

/** libzstd's errors for a valid frame it cannot decode, and why it cannot */
const VALID_DATA_ERRORS = new Map<string, FailureReason>([
  ['ZSTD_error_dictionary_wrong', 'unsupported'],
  ['ZSTD_error_frameParameter_unsupported', 'unsupported'],
  ['ZSTD_error_frameParameter_windowTooLarge', 'unsupported'],
  ['ZSTD_error_memory_allocation', 'insufficient-memory'],
]);

const MAGIC_SIZE = 4;
const DATA_FRAME_MAGIC = 0xfd2fb528;
const SKIPPABLE_FRAME_MAGIC_HIGH_BITS = 0x184d2a5;
const BLOCK_HEADER_SIZE = 3;
const RLE_BLOCK = 1;
const RESERVED_BLOCK = 3;
const CHECKSUM_SIZE = 4;

/**
 * The largest window a frame may ask for: 2 GiB, the most libzstd decodes on
 * a 64-bit host (RFC 8878 itself allows up to 3.75 TB, section 3.1.1.1.2).
 * The file names its own window, so a viewer that refuses a large one cannot
 * show a valid file at all.
 */
const WINDOW_LOG_MAX = 31;

/**
 * Decompress Zstandard data, every frame included
 */
export async function* decompressZstd(
  compressed: AsyncIterable<Buffer>,
): AsyncGenerator<Buffer> {
  const reader = new ByteReader(compressed);
  try {
    for (let start = true; !(await reader.atEnd()); start = false) {
      const magicBytes = await reader.peek(MAGIC_SIZE);
      const magic =
        magicBytes.length === MAGIC_SIZE ? magicBytes.readUInt32LE(0) : null;

      if (magic === DATA_FRAME_MAGIC) {
        yield* transformed(
          dataFrame(reader),
          zlib.createZstdDecompress({
            params: { [zlib.constants.ZSTD_d_windowLogMax]: WINDOW_LOG_MAX },
          }),
        );
      } else if (
        magic !== null &&
        magic >>> 4 === SKIPPABLE_FRAME_MAGIC_HIGH_BITS
      ) {
        await skipFrame(reader);
      } else {
        // Not a frame where one must start: at the very beginning the file is
        // not Zstandard at all, anywhere later the data after the last frame
        // is junk
        throw start
          ? new DecompressionFailure('not-this-format', 'No Zstandard frame')
          : new DecompressionFailure('damaged', 'Junk after the last frame');
      }
    }
  } catch (error) {
    throw asFailure(error, reasonFor);
  } finally {
    await reader.close();
  }
}

/**
 * The bytes of the data frame at the front of `reader`, read up to its end
 * (RFC 8878, section 3.1.1)
 */
async function* dataFrame(reader: ByteReader): AsyncGenerator<Buffer> {
  const start = await reader.read(MAGIC_SIZE + 1);
  yield start;

  const descriptor = start[MAGIC_SIZE];
  const contentSizeFlag = descriptor >> 6;
  const singleSegment = (descriptor & 0x20) !== 0;
  const hasChecksum = (descriptor & 0x04) !== 0;
  const dictionaryIdFlag = descriptor & 0x03;

  const windowDescriptorSize = singleSegment ? 0 : 1;
  const dictionaryIdSize = [0, 1, 2, 4][dictionaryIdFlag];
  const contentSizeSize = [singleSegment ? 1 : 0, 2, 4, 8][contentSizeFlag];
  const headerRest = windowDescriptorSize + dictionaryIdSize + contentSizeSize;
  if (headerRest > 0) {
    yield await reader.read(headerRest);
  }

  for (let lastBlock = false; !lastBlock; ) {
    const blockHeader = await reader.read(BLOCK_HEADER_SIZE);
    yield blockHeader;
    const header = blockHeader.readUIntLE(0, BLOCK_HEADER_SIZE);
    lastBlock = (header & 1) !== 0;
    const blockType = (header >> 1) & 3;
    if (blockType === RESERVED_BLOCK) {
      throw new DecompressionFailure('damaged', 'Reserved block type');
    }
    yield* reader.pieces(blockType === RLE_BLOCK ? 1 : header >>> 3);
  }

  if (hasChecksum) {
    yield await reader.read(CHECKSUM_SIZE);
  }
}

/**
 * Read past the skippable frame at the front of `reader` (section 3.1.2)
 */
async function skipFrame(reader: ByteReader): Promise<void> {
  const header = await reader.read(MAGIC_SIZE + 4);
  await reader.skip(header.readUInt32LE(MAGIC_SIZE));
}

function reasonFor(error: unknown): FailureReason {
  const code = (error as { code?: unknown } | null)?.code;
  return (typeof code === 'string' && VALID_DATA_ERRORS.get(code)) || 'damaged';
}
