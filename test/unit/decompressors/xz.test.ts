/**
 * Tests for XZ decompression
 *
 * Strategy: Generate text -> compress with system xz -> decompress with our code -> verify match
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { decompressXzFile, xzBufferToText } from '../../../src/decompressors/xz';
import {
  generateLogContent,
  createTempDir,
  cleanupTempDir,
  commandExists,
  compressWithXz,
  createTarXz,
  STANDARD_TEST_CASES,
} from '../../support';

describe('XZ Decompression', function () {
  // Increase timeout for compression operations
  this.timeout(30000);

  let tempDir: string;
  const hasXz = commandExists('xz');
  const hasTar = commandExists('tar');

  before(function () {
    if (!hasXz) {
      this.skip();
    }
    tempDir = createTempDir();
  });

  after(function () {
    if (tempDir) {
      cleanupTempDir(tempDir);
    }
  });

  describe('decompressXzFile', function () {
    for (const testCase of STANDARD_TEST_CASES) {
      it(`should correctly decompress ${testCase.description}`, async function () {
        // Generate original content
        const originalContent = generateLogContent(testCase.lines);

        // Write to temp file
        const txtPath = path.join(tempDir, `${testCase.name}.txt`);
        await fs.promises.writeFile(txtPath, originalContent);

        // Compress with system xz
        const xzPath = compressWithXz(txtPath);

        // Decompress with our code
        const decompressedBuffer = await decompressXzFile(xzPath);

        // Convert to text
        const decompressedText = await xzBufferToText(
          decompressedBuffer,
          xzPath,
        );

        // Verify content matches exactly
        expect(decompressedText).to.equal(originalContent);
        expect(decompressedText.length).to.equal(originalContent.length);

        // Verify line count
        const originalLines = originalContent.split('\n').filter((l) => l);
        const decompressedLines = decompressedText.split('\n').filter((l) => l);
        expect(decompressedLines.length).to.equal(originalLines.length);
      });
    }

    it('should handle binary content correctly', async function () {
      // Generate binary content (all byte values)
      const binaryContent = Buffer.alloc(256 * 100);
      for (let i = 0; i < binaryContent.length; i++) {
        binaryContent[i] = i % 256;
      }

      const binPath = path.join(tempDir, 'binary.bin');
      await fs.promises.writeFile(binPath, binaryContent);

      const xzPath = compressWithXz(binPath);
      const decompressedBuffer = await decompressXzFile(xzPath);

      expect(decompressedBuffer.length).to.equal(binaryContent.length);
      expect(Buffer.compare(decompressedBuffer, binaryContent)).to.equal(0);
    });
  });

  describe('tar.xz support', function () {
    before(function () {
      if (!hasTar) {
        this.skip();
      }
    });

    it('should extract text from tar.xz archive', async function () {
      const originalContent = generateLogContent(100);
      const txtPath = path.join(tempDir, 'archive-test.txt');
      await fs.promises.writeFile(txtPath, originalContent);

      const tarXzPath = createTarXz(txtPath);
      const decompressedBuffer = await decompressXzFile(tarXzPath);
      const decompressedText = await xzBufferToText(
        decompressedBuffer,
        tarXzPath,
      );

      expect(decompressedText).to.equal(originalContent);
    });
  });
});
