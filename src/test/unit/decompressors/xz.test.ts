/**
 * XZ stream layouts beyond what the shared format suite covers
 *
 * Concatenated XZ streams may be separated by Stream Padding, null bytes
 * whose count must be a multiple of four (XZ file format, section 2.2).
 */

import { expect } from 'chai';
import { decompressXz } from '../../../decompressors/xz';
import { DecompressionFailure } from '../../../decompressors/failure';
import { decodeWhole, generateLogContent, runTool } from '../../support';

describe('XZ streams', function () {
  const first = generateLogContent(10);
  const second = generateLogContent(20);

  function padded(padding: number): Buffer {
    return Buffer.concat([
      runTool('xz', ['-c'], first),
      Buffer.alloc(padding),
      runTool('xz', ['-c'], second),
    ]);
  }

  it('decodes streams separated by padding of whole four-byte units', async function () {
    const decompressed = await decodeWhole(decompressXz, padded(8));
    expect(decompressed.toString()).to.equal(first + second);
  });

  it('reports padding of another length as damaged', async function () {
    let failure: unknown;
    try {
      await decodeWhole(decompressXz, padded(3));
    } catch (error) {
      failure = error;
    }
    expect(failure).to.be.instanceOf(DecompressionFailure);
    expect((failure as DecompressionFailure).reason).to.equal('damaged');
  });
});
