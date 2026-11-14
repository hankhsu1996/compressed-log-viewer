# Compressed Log Viewer

View compressed log files directly in VS Code. Supports XZ, bzip2 and Zstandard.

## Features

- One-click viewing of compressed files
- Native text editor integration
- Fast decompression

## Supported Formats

| Format    | Files               |
| --------- | ------------------- |
| XZ        | `.xz`, `.tar.xz`    |
| bzip2     | `.bz2`, `.tar.bz2`  |
| Zstandard | `.zst`, `.tar.zst`  |

A file made of several compressed parts joined together, such as the output of `pbzip2` or
`cat a.zst b.zst`, is shown in full. A tar archive of several files shows each one after a
`==> name <==` line, the way `head` shows several files.

## Usage

Just click on any compressed file to view it!

A file that decompresses to more than 50 MB is not previewed. Its tab offers to decompress it to disk instead, without holding it in memory.

## Requirements

VS Code 1.103.0 or newer

## Attribution

Icon: <a href="https://www.flaticon.com/free-icons/compressed" title="compressed icons">Compressed icons created by Smashicons - Flaticon</a>
