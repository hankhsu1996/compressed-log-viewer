/**
 * System compression utilities for testing
 *
 * Uses system bzip2/xz commands to create known-good compressed files
 * that we can test our decompression against.
 */

import { execSync } from 'child_process';

/**
 * Check if a command is available on the system
 */
export function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compress a file using system bzip2
 * @returns path to the compressed file
 */
export function compressWithBzip2(inputPath: string): string {
  const outputPath = `${inputPath}.bz2`;
  execSync(`bzip2 -k -f "${inputPath}"`);
  return outputPath;
}

/**
 * Compress a file using system xz
 * @returns path to the compressed file
 */
export function compressWithXz(inputPath: string): string {
  const outputPath = `${inputPath}.xz`;
  execSync(`xz -k -f "${inputPath}"`);
  return outputPath;
}

/**
 * Create a tar.bz2 archive containing a single file
 * @returns path to the archive
 */
export function createTarBz2(inputPath: string): string {
  const path = require('path');
  const dir = path.dirname(inputPath);
  const filename = path.basename(inputPath);
  const outputPath = `${inputPath}.tar.bz2`;
  execSync(`tar -cjf "${outputPath}" -C "${dir}" "${filename}"`);
  return outputPath;
}

/**
 * Create a tar.xz archive containing a single file
 * @returns path to the archive
 */
export function createTarXz(inputPath: string): string {
  const path = require('path');
  const dir = path.dirname(inputPath);
  const filename = path.basename(inputPath);
  const outputPath = `${inputPath}.tar.xz`;
  execSync(`tar -cJf "${outputPath}" -C "${dir}" "${filename}"`);
  return outputPath;
}
