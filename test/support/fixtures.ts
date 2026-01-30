/**
 * Test data generation utilities
 */

import * as crypto from 'crypto';

/**
 * Generate log-like text content with predictable output
 */
export function generateLogContent(lines: number): string {
  const entries: string[] = [];
  for (let i = 0; i < lines; i++) {
    // Use fixed timestamp for reproducibility
    const timestamp = new Date(1700000000000 + i * 1000).toISOString();
    const level = ['INFO', 'DEBUG', 'WARN', 'ERROR'][i % 4];
    entries.push(
      `${timestamp} [${level}] Line ${i}: Sample log message value=${i * 42}`,
    );
  }
  return entries.join('\n') + '\n';
}

/**
 * Generate random text content with varied patterns
 * Uses a seed for reproducibility while still having varied content
 */
export function generateRandomTextContent(size: number, seed: number): string {
  // Use seed for reproducible "random" content
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \n\t.,;:!?-_=+[]{}()';
  const result: string[] = [];
  let state = seed;

  for (let i = 0; i < size; i++) {
    // Simple PRNG (linear congruential generator)
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    result.push(chars[state % chars.length]);
  }

  return result.join('');
}

/**
 * Generate truly random binary content
 */
export function generateRandomBinaryContent(size: number): Buffer {
  return crypto.randomBytes(size);
}

/**
 * Generate binary content with all byte values (sequential pattern)
 */
export function generateBinaryContent(size: number): Buffer {
  const buffer = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = i % 256;
  }
  return buffer;
}

/**
 * Test case definition
 */
export interface TestCase {
  name: string;
  lines: number;
  description: string;
}

/**
 * Standard test cases covering different file sizes
 * BZ2 block size is ~900KB per block (with block size 9)
 */
export const STANDARD_TEST_CASES: TestCase[] = [
  { name: 'tiny', lines: 10, description: 'tiny file (~1KB)' },
  { name: 'small', lines: 100, description: 'small file (~10KB)' },
  { name: 'medium', lines: 1000, description: 'medium file (~100KB)' },
  { name: 'multiblock', lines: 15000, description: 'multi-block file (~1.5MB)' },
];

/**
 * Large test cases for stress testing (slower, run separately)
 * 750000 lines ≈ 50MB ≈ 55+ BZ2 blocks
 */
export const LARGE_TEST_CASES: TestCase[] = [
  { name: 'large', lines: 750000, description: 'large file (~50MB, 55+ blocks)' },
];
