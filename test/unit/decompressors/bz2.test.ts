/**
 * Tests for BZ2 decompression
 *
 * Testing strategies:
 * 1. Compare against original content (basic correctness)
 * 2. Compare against system bzip2 output (golden master - catches library bugs)
 * 3. Test with varied content patterns (random, binary, etc.)
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  decompressBz2File,
  bz2BufferToText,
} from '../../../src/decompressors/bz2';
import {
  generateLogContent,
  generateRandomTextContent,
  generateRandomBinaryContent,
  createTempDir,
  cleanupTempDir,
  commandExists,
  compressWithBzip2,
  createTarBz2,
  STANDARD_TEST_CASES,
  LARGE_TEST_CASES,
} from '../../support';

describe('BZ2 Decompression', function () {
  this.timeout(30000);

  let tempDir: string;
  const hasBzip2 = commandExists('bzip2');
  const hasTar = commandExists('tar');

  before(function () {
    if (!hasBzip2) {
      this.skip();
    }
    tempDir = createTempDir();
  });

  after(function () {
    if (tempDir) {
      cleanupTempDir(tempDir);
    }
  });

  describe('basic correctness', function () {
    for (const testCase of STANDARD_TEST_CASES) {
      it(`should correctly decompress ${testCase.description}`, async function () {
        const originalContent = generateLogContent(testCase.lines);
        const txtPath = path.join(tempDir, `${testCase.name}.txt`);
        await fs.promises.writeFile(txtPath, originalContent);

        const bz2Path = compressWithBzip2(txtPath);
        const decompressedBuffer = await decompressBz2File(bz2Path);
        const decompressedText = await bz2BufferToText(decompressedBuffer, bz2Path);

        expect(decompressedText).to.equal(originalContent);
      });
    }
  });

  // Golden master testing: compare our output against system bzip2
  // This catches bugs that comparing against original might miss
  describe('golden master (vs system bzip2)', function () {
    it('should match system bzip2 output for random text content', async function () {
      // Generate random text content (~2MB to ensure multiple blocks)
      const content = generateRandomTextContent(2 * 1024 * 1024, 12345);
      const txtPath = path.join(tempDir, 'random-text.txt');
      await fs.promises.writeFile(txtPath, content);

      const bz2Path = compressWithBzip2(txtPath);

      // Decompress with system bzip2
      const systemOutput = execSync(`bzip2 -d -c "${bz2Path}"`, {
        maxBuffer: 50 * 1024 * 1024,
      });

      // Decompress with our code
      const ourOutput = await decompressBz2File(bz2Path);

      expect(ourOutput.length).to.equal(systemOutput.length, 'Size mismatch');
      expect(Buffer.compare(ourOutput, systemOutput)).to.equal(0, 'Content mismatch');
    });

    it('should match system bzip2 output for random binary content', async function () {
      // Generate random binary content (~2MB)
      const content = generateRandomBinaryContent(2 * 1024 * 1024);
      const binPath = path.join(tempDir, 'random-binary.bin');
      await fs.promises.writeFile(binPath, content);

      const bz2Path = compressWithBzip2(binPath);

      const systemOutput = execSync(`bzip2 -d -c "${bz2Path}"`, {
        maxBuffer: 50 * 1024 * 1024,
      });

      const ourOutput = await decompressBz2File(bz2Path);

      expect(ourOutput.length).to.equal(systemOutput.length, 'Size mismatch');
      expect(Buffer.compare(ourOutput, systemOutput)).to.equal(0, 'Content mismatch');
    });

    // Test with multiple different random seeds to increase coverage
    for (const seed of [1, 42, 999, 123456]) {
      it(`should match system bzip2 for multi-block random content (seed=${seed})`, async function () {
        // ~1.5MB to ensure multiple BZ2 blocks
        const content = generateRandomTextContent(1500000, seed);
        const txtPath = path.join(tempDir, `random-seed-${seed}.txt`);
        await fs.promises.writeFile(txtPath, content);

        const bz2Path = compressWithBzip2(txtPath);

        const systemOutput = execSync(`bzip2 -d -c "${bz2Path}"`, {
          maxBuffer: 50 * 1024 * 1024,
        });

        const ourOutput = await decompressBz2File(bz2Path);

        expect(ourOutput.length).to.equal(systemOutput.length, 'Size mismatch');
        expect(Buffer.compare(ourOutput, systemOutput)).to.equal(0, 'Content mismatch');
      });
    }
  });

  describe('binary content', function () {
    it('should handle sequential binary content', async function () {
      const binaryContent = Buffer.alloc(256 * 100);
      for (let i = 0; i < binaryContent.length; i++) {
        binaryContent[i] = i % 256;
      }

      const binPath = path.join(tempDir, 'binary.bin');
      await fs.promises.writeFile(binPath, binaryContent);

      const bz2Path = compressWithBzip2(binPath);
      const decompressedBuffer = await decompressBz2File(bz2Path);

      expect(decompressedBuffer.length).to.equal(binaryContent.length);
      expect(Buffer.compare(decompressedBuffer, binaryContent)).to.equal(0);
    });

    it('should handle random binary content', async function () {
      const binaryContent = generateRandomBinaryContent(100000);
      const binPath = path.join(tempDir, 'random-binary-small.bin');
      await fs.promises.writeFile(binPath, binaryContent);

      const bz2Path = compressWithBzip2(binPath);
      const decompressedBuffer = await decompressBz2File(bz2Path);

      expect(decompressedBuffer.length).to.equal(binaryContent.length);
      expect(Buffer.compare(decompressedBuffer, binaryContent)).to.equal(0);
    });
  });

  describe('tar.bz2 support', function () {
    before(function () {
      if (!hasTar) {
        this.skip();
      }
    });

    it('should extract text from tar.bz2 archive', async function () {
      const originalContent = generateLogContent(100);
      const txtPath = path.join(tempDir, 'archive-test.txt');
      await fs.promises.writeFile(txtPath, originalContent);

      const tarBz2Path = createTarBz2(txtPath);
      const decompressedBuffer = await decompressBz2File(tarBz2Path);
      const decompressedText = await bz2BufferToText(decompressedBuffer, tarBz2Path);

      expect(decompressedText).to.equal(originalContent);
    });
  });

  // Large file tests
  describe('large files (50MB+)', function () {
    this.timeout(300000);

    for (const testCase of LARGE_TEST_CASES) {
      it(`should correctly decompress ${testCase.description}`, async function () {
        const originalContent = generateLogContent(testCase.lines);
        const txtPath = path.join(tempDir, `${testCase.name}.txt`);
        await fs.promises.writeFile(txtPath, originalContent);

        const bz2Path = compressWithBzip2(txtPath);

        // Golden master: compare against system bzip2
        const systemOutput = execSync(`bzip2 -d -c "${bz2Path}"`, {
          maxBuffer: 200 * 1024 * 1024,
        });

        const ourOutput = await decompressBz2File(bz2Path);

        expect(ourOutput.length).to.equal(systemOutput.length, 'Size mismatch with system bzip2');
        expect(Buffer.compare(ourOutput, systemOutput)).to.equal(0, 'Content mismatch with system bzip2');
      });
    }
  });
});
