/**
 * The sentence the user reads when a file cannot be shown
 *
 * It names the file, says what is wrong with it in the user's terms, and
 * leaves the library's own wording to the output channel.
 */

import { expect } from 'chai';
import { describeFailure } from '../../failureMessages';
import {
  DecompressionFailure,
  FAILURE_REASONS,
  FailureReason,
} from '../../decompressors/failure';
import { CompressionFormat, FORMATS } from '../../decompressors/formats';

function formatWithSuffix(suffix: string): CompressionFormat {
  const format = FORMATS.find((candidate) => candidate.suffix === suffix);
  if (!format) {
    throw new Error(`No format registered for ${suffix}`);
  }
  return format;
}

const zstd = formatWithSuffix('.zst');

const LIBRARY_DETAIL = 'LZMA_DATA_ERROR: Data is corrupt at byte 63';

function messageFor(reason: FailureReason, cause?: unknown): string {
  return describeFailure(
    'app.log.zst',
    zstd,
    new DecompressionFailure(reason, LIBRARY_DETAIL, { cause }),
  );
}

describe('failure messages', function () {
  for (const reason of FAILURE_REASONS) {
    it(`names the file and hides library detail when ${reason}`, function () {
      const message = messageFor(reason);
      expect(message).to.include('app.log.zst');
      expect(message).not.to.include(LIBRARY_DETAIL);
      expect(message).not.to.match(/Error|byte/);
    });
  }

  it('says which format the name promised when the contents are not it', function () {
    const message = messageFor('not-this-format');
    expect(message).to.include('Zstandard');
    expect(message).to.include('.zst');
  });

  it('says why a file could not be read', function () {
    const missing = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    const denied = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    expect(messageFor('unreadable', missing)).to.include('no longer exists');
    expect(messageFor('unreadable', denied)).to.include('permission');
  });

  it('gives a plain sentence for an error nobody sorted', function () {
    const message = describeFailure(
      'app.log.zst',
      zstd,
      new TypeError('Cannot read properties of undefined'),
    );
    expect(message).to.include('app.log.zst');
    expect(message).not.to.match(/TypeError|undefined/);
  });
});
