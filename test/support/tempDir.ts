/**
 * Temporary directory management for tests
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const TEMP_PREFIX = 'compressed-log-viewer-test-';

/**
 * Create a temporary directory for test files
 * @returns path to the created directory
 */
export function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
}

/**
 * Clean up a temporary directory and all its contents
 */
export function cleanupTempDir(dir: string): void {
  if (dir && dir.includes(TEMP_PREFIX)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
