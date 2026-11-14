/**
 * bzip2 output compared with the system bzip2 tool
 *
 * The shared format suite checks round trips; these cases compare our output
 * with what `bzip2 -d` produces for the same file, across many blocks, which
 * is where an earlier decoder library lost data.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { decompressBz2 } from '../../../decompressors/bz2';
import {
  generateLogContent,
  generateRandomTextContent,
  generateRandomBinaryContent,
  createTempDir,
  cleanupTempDir,
  runTool,
  decodeWhole,
  LARGE_TEST_CASES,
} from '../../support';

describe('bzip2 against the system tool', function () {
  this.timeout(30000);

  let tempDir: string;

  before(function () {
    tempDir = createTempDir();
  });

  after(function () {
    if (tempDir) {
      cleanupTempDir(tempDir);
    }
  });

  async function expectSameAsSystemBzip2(
    name: string,
    content: Buffer | string,
  ) {
    const filePath = path.join(tempDir, name);
    await fs.promises.writeFile(filePath, content);
    runTool('bzip2', ['-k', '-f', filePath]);
    const bz2Path = `${filePath}.bz2`;

    const systemOutput = runTool('bzip2', ['-d', '-c', bz2Path]);
    const ourOutput = await decodeWhole(
      decompressBz2,
      await fs.promises.readFile(bz2Path),
    );

    expect(ourOutput.length).to.equal(systemOutput.length, 'Size mismatch');
    expect(Buffer.compare(ourOutput, systemOutput)).to.equal(
      0,
      'Content mismatch',
    );
  }

  it('matches for random text over several blocks', async function () {
    await expectSameAsSystemBzip2(
      'random-text.txt',
      generateRandomTextContent(2 * 1024 * 1024, 12345),
    );
  });

  it('matches for random binary content', async function () {
    await expectSameAsSystemBzip2(
      'random-binary.bin',
      generateRandomBinaryContent(2 * 1024 * 1024),
    );
  });

  for (const seed of [1, 42, 999, 123456]) {
    it(`matches for multi-block random content (seed=${seed})`, async function () {
      await expectSameAsSystemBzip2(
        `random-seed-${seed}.txt`,
        generateRandomTextContent(1500000, seed),
      );
    });
  }

  describe('large files (50MB+)', function () {
    this.timeout(300000);

    for (const testCase of LARGE_TEST_CASES) {
      it(`matches for a ${testCase.description}`, async function () {
        await expectSameAsSystemBzip2(
          `${testCase.name}.txt`,
          generateLogContent(testCase.lines),
        );
      });
    }
  });
});
