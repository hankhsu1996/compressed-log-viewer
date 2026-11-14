/**
 * Behaviour every compression format must share
 *
 * Each case runs once per format: compress with a reference implementation,
 * write the file under a real name, then decode it the way the extension does.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  FORMATS,
  decompressToFile,
  decompressedChunks,
  findFormat,
  readPreview,
} from '../../../decompressors/formats';
import {
  DecompressionFailure,
  FailureReason,
} from '../../../decompressors/failure';
import {
  generateLogContent,
  generateBinaryContent,
  generateRandomBinaryContent,
  createTempDir,
  cleanupTempDir,
  referenceCompressor,
  tarOf,
  chunked,
  collect,
  STANDARD_TEST_CASES,
} from '../../support';

/** A file cut shorter than this may not even be recognisable as its format */
const LONGEST_MAGIC = 6;

for (const format of FORMATS) {
  describe(`${format.suffix} format`, function () {
    this.timeout(30000);

    let tempDir: string;
    let compress: (data: Buffer) => Buffer;

    before(function () {
      compress = referenceCompressor(format);
      tempDir = createTempDir();
    });

    after(function () {
      if (tempDir) {
        cleanupTempDir(tempDir);
      }
    });

    async function writeFixture(name: string, bytes: Buffer): Promise<string> {
      const filePath = path.join(tempDir, name);
      await fs.promises.writeFile(filePath, bytes);
      return filePath;
    }

    /** The text the extension shows for a file, with no size limit */
    async function readText(filePath: string): Promise<string> {
      const preview = await readPreview(format, filePath, Infinity);
      if (preview.kind !== 'text') {
        throw new Error(`${filePath} was not shown as text`);
      }
      return preview.text;
    }

    for (const testCase of STANDARD_TEST_CASES) {
      it(`shows the text of a ${testCase.description}`, async function () {
        const content = generateLogContent(testCase.lines);
        const filePath = await writeFixture(
          `${testCase.name}.log${format.suffix}`,
          compress(Buffer.from(content)),
        );

        expect(await readText(filePath)).to.equal(content);
      });
    }

    it('decodes binary content byte for byte', async function () {
      const content = generateBinaryContent(256 * 100);
      const filePath = await writeFixture(
        `binary.bin${format.suffix}`,
        compress(content),
      );

      const decompressed = await collect(decompressedChunks(format, filePath));
      expect(Buffer.compare(decompressed, content)).to.equal(0);
    });

    it('decodes data that arrives one byte at a time', async function () {
      const content = generateLogContent(20);
      const decompressed = await collect(
        format.decompress(chunked(compress(Buffer.from(content)), 1)),
      );
      expect(decompressed.toString()).to.equal(content);
    });

    it('stops decompressing once the preview limit is passed', async function () {
      // Bytes that do not compress, so the input spans several bzip2 blocks
      const content = generateRandomBinaryContent(3 * 1024 * 1024);
      const compressed = compress(content);
      const filePath = await writeFixture(
        `limit.log${format.suffix}`,
        compressed,
      );
      expect(await readPreview(format, filePath, 1024 * 1024)).to.deep.equal({
        kind: 'too-large',
      });

      // Pull a little output, then stop: most of the input is never read
      const source = chunked(compressed, 1024);
      for await (const chunk of format.decompress(source)) {
        if (chunk.length > 0) {
          break;
        }
      }
      expect(source.pulled).to.be.below(source.total / 2);
    });

    it('decompresses to a file', async function () {
      const content = Buffer.from(generateLogContent(5000));
      const filePath = await writeFixture(
        `save.log${format.suffix}`,
        compress(content),
      );
      const destination = path.join(tempDir, `saved${format.suffix}.log`);
      await decompressToFile(format, filePath, destination);
      expect(
        Buffer.compare(await fs.promises.readFile(destination), content),
      ).to.equal(0);
    });

    it('shows the file inside a tar archive of one file', async function () {
      const content = generateLogContent(100);
      const filePath = await writeFixture(
        `archive.tar${format.suffix}`,
        compress(tarOf({ 'archive.log': content })),
      );

      expect(await readText(filePath)).to.equal(content);
    });

    it('shows each file of a tar archive under its name', async function () {
      const api = generateLogContent(3);
      const worker = 'no newline at the end';
      const filePath = await writeFixture(
        `several.tar${format.suffix}`,
        compress(tarOf({ 'api.log': api, 'worker.log': worker })),
      );

      expect(await readText(filePath)).to.equal(
        `==> api.log <==\n${api}\n==> worker.log <==\n${worker}`,
      );
    });

    it('treats an upper-case file name like a lower-case one', async function () {
      const content = generateLogContent(10);
      const filePath = await writeFixture(
        `UPPER.TAR${format.suffix.toUpperCase()}`,
        compress(tarOf({ 'upper.log': content })),
      );

      expect(findFormat(filePath)).to.equal(format);
      expect(await readText(filePath)).to.equal(content);
    });

    it('shows every member of concatenated compressed data', async function () {
      const first = generateLogContent(10);
      const second = generateLogContent(20);
      const filePath = await writeFixture(
        `concatenated.log${format.suffix}`,
        Buffer.concat([
          compress(Buffer.from(first)),
          compress(Buffer.from(second)),
        ]),
      );

      expect(await readText(filePath)).to.equal(first + second);
    });

    describe('says why a file cannot be shown', function () {
      async function failureReason(
        name: string,
        bytes: Buffer,
      ): Promise<FailureReason> {
        const filePath = await writeFixture(name, bytes);
        try {
          await readText(filePath);
        } catch (error) {
          expect(error).to.be.instanceOf(DecompressionFailure);
          return (error as DecompressionFailure).reason;
        }
        throw new Error(`${name} was shown instead of failing`);
      }

      const compressed = () => compress(Buffer.from(generateLogContent(1000)));

      it('an empty file', async function () {
        expect(
          await failureReason(`empty.log${format.suffix}`, Buffer.alloc(0)),
        ).to.equal('empty');
      });

      it('plain text named as this format', async function () {
        expect(
          await failureReason(
            `plain.log${format.suffix}`,
            Buffer.from(generateLogContent(5)),
          ),
        ).to.equal('not-this-format');
      });

      it('data cut short anywhere, instead of showing part of it', async function () {
        const first = compress(Buffer.from(generateLogContent(20)));
        const both = Buffer.concat([
          first,
          compress(Buffer.from(generateLogContent(30))),
        ]);
        const accepted: number[] = [];
        for (let length = 1; length < both.length; length++) {
          if (length === first.length) {
            continue; // the first member alone is a complete file
          }
          const reason = await failureReason(
            `cut-${length}.log${format.suffix}`,
            both.subarray(0, length),
          ).catch(() => undefined);
          const expected = length < LONGEST_MAGIC ? undefined : 'damaged';
          if (reason === undefined || (expected && reason !== expected)) {
            accepted.push(length);
          }
        }
        expect(accepted, 'cut lengths not reported as damaged').to.deep.equal(
          [],
        );
      });

      it('a corrupted byte', async function () {
        const data = Buffer.from(compressed());
        data[Math.floor(data.length / 2)] ^= 0xff;
        expect(
          await failureReason(`corrupt.log${format.suffix}`, data),
        ).to.equal('damaged');
      });

      it('junk after the compressed data', async function () {
        expect(
          await failureReason(
            `trailing.log${format.suffix}`,
            Buffer.concat([compressed(), Buffer.from('junk')]),
          ),
        ).to.equal('damaged');
      });

      it('a tar file name whose contents are not a tar archive', async function () {
        for (const lines of [1, 50]) {
          expect(
            await failureReason(
              `notatar-${lines}.tar${format.suffix}`,
              compress(Buffer.from(generateLogContent(lines))),
            ),
          ).to.equal('not-a-tar-archive');
        }
      });

      it('a tar archive cut short inside a file', async function () {
        const archive = tarOf({ 'cut.log': generateLogContent(100) });
        expect(
          await failureReason(
            `cut.tar${format.suffix}`,
            compress(archive.subarray(0, 2000)),
          ),
        ).to.equal('damaged');
      });

      it('a file that does not exist', async function () {
        let failure: unknown;
        try {
          await readText(path.join(tempDir, `missing.log${format.suffix}`));
        } catch (error) {
          failure = error;
        }
        expect(failure).to.be.instanceOf(DecompressionFailure);
        expect((failure as DecompressionFailure).reason).to.equal('unreadable');
      });
    });
  });
}
