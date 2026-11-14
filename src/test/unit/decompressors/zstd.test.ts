/**
 * Zstandard frame layouts beyond what the shared format suite covers
 *
 * RFC 8878 lets one file hold any mix of data frames and skippable frames,
 * with optional checksums, optional content sizes and three kinds of block.
 * Each layout below is one that real encoders produce.
 */

import { expect } from 'chai';
import * as zlib from 'zlib';
import { decompressZstd } from '../../../decompressors/zstd';
import { DecompressionFailure } from '../../../decompressors/failure';
import {
  decodeWhole,
  generateLogContent,
  generateRandomBinaryContent,
} from '../../support';

/** Compress through the streaming API, so the frame does not record its size */
function compressStreamed(
  chunks: Buffer[],
  params: Record<number, number>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const compressor = zlib.createZstdCompress({ params });
    const out: Buffer[] = [];
    compressor.on('data', (chunk: Buffer) => out.push(chunk));
    compressor.on('end', () => resolve(Buffer.concat(out)));
    compressor.on('error', reject);
    for (const chunk of chunks) {
      compressor.write(chunk);
    }
    compressor.end();
  });
}

function skippableFrame(payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(0x184d2a53, 0);
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

describe('Zstandard frames', function () {
  this.timeout(30000);

  it('skips a skippable frame between data frames', async function () {
    const first = Buffer.from(generateLogContent(10));
    const second = Buffer.from(generateLogContent(20));
    const data = Buffer.concat([
      zlib.zstdCompressSync(first),
      skippableFrame(Buffer.from('seek table or other metadata')),
      zlib.zstdCompressSync(second),
    ]);

    const decompressed = await decodeWhole(decompressZstd, data);
    expect(decompressed.toString()).to.equal(
      first.toString() + second.toString(),
    );
  });

  it('decodes frames of every block kind, with and without checksum or size', async function () {
    const text = Buffer.from(generateLogContent(2000));
    const incompressible = generateRandomBinaryContent(300 * 1024);
    const run = Buffer.alloc(200 * 1024, 0x61);
    const checksum = { [zlib.constants.ZSTD_c_checksumFlag]: 1 };
    const frames = [
      zlib.zstdCompressSync(text, { params: checksum }),
      zlib.zstdCompressSync(incompressible),
      zlib.zstdCompressSync(run, { params: checksum }),
      await compressStreamed(
        [text.subarray(0, 1000), text.subarray(1000)],
        checksum,
      ),
      await compressStreamed([incompressible], {}),
    ];

    const decompressed = await decodeWhole(
      decompressZstd,
      Buffer.concat(frames),
    );
    const expected = Buffer.concat([
      text,
      incompressible,
      run,
      text,
      incompressible,
    ]);
    expect(decompressed.length).to.equal(expected.length);
    expect(Buffer.compare(decompressed, expected)).to.equal(0);
  });

  it('decodes a frame whose window is larger than 128 MiB', async function () {
    const content = Buffer.from(generateLogContent(100));
    const frame = await compressStreamed(
      [content.subarray(0, 100), content.subarray(100)],
      { [zlib.constants.ZSTD_c_windowLog]: 30 },
    );

    const decompressed = await decodeWhole(decompressZstd, frame);
    expect(decompressed.toString()).to.equal(content.toString());
  });

  it('decodes a file that starts with a skippable frame', async function () {
    const content = Buffer.from(generateLogContent(10));
    const data = Buffer.concat([
      skippableFrame(Buffer.from('metadata first')),
      zlib.zstdCompressSync(content),
    ]);

    const decompressed = await decodeWhole(decompressZstd, data);
    expect(decompressed.toString()).to.equal(content.toString());
  });

  it('reports a frame that needs a dictionary as unsupported', async function () {
    // A frame compressed with a trained dictionary names the dictionary's ID
    // in its header (RFC 8878, section 3.1.1.1.3). Build one by adding a
    // one-byte ID to an ordinary single-segment frame's header.
    const plain = zlib.zstdCompressSync(Buffer.from(generateLogContent(10)));
    const descriptor = plain[4];
    expect(descriptor & 0x23).to.equal(0x20, 'expected a single-segment frame');
    const data = Buffer.concat([
      plain.subarray(0, 4),
      Buffer.from([descriptor | 0x01, 0x2a]),
      plain.subarray(5),
    ]);

    let failure: unknown;
    try {
      await decodeWhole(decompressZstd, data);
    } catch (error) {
      failure = error;
    }
    expect(failure).to.be.instanceOf(DecompressionFailure);
    expect((failure as DecompressionFailure).reason).to.equal('unsupported');
  });
});
