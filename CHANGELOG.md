# Change Log

All notable changes to the "Compressed Log Viewer" extension will be documented in this file.

## [1.1.0] - 2026-11-14

### Added
- Support for viewing Zstandard files (`.zst`, `.tar.zst`)

### Fixed
- bzip2 files made of several joined streams (`pbzip2` output, `cat a.bz2 b.bz2`) showed only the first stream
- Tar archives with an upper-case name (`LOGS.TAR.XZ`) showed raw archive bytes instead of the files inside
- "Decompress Here" replaced an existing file of the same name without asking
- Cancelling the large-file prompt left an empty editor tab open
- A large file was decompressed whole into memory, twice, before being found too large to preview; decompression now stops at the preview limit, and writing to disk streams
- A bzip2 or tar archive cut short at a block or file boundary showed its first part as if complete; XZ files with invalid padding between streams were accepted
- A file opened by the editor was decompressed twice
- Closing the tab while a file was decompressing could open the file anyway, or log errors

### Changed
- A file that cannot be shown now explains why in its editor tab, in plain words (empty, not this format, damaged or incomplete, not a tar archive, unsupported options, not enough memory, unreadable), with buttons such as "Open as Plain Text" and "Show Details", instead of a pop-up with the decoder's raw error
- A tar archive of several files shows each one after a `==> name <==` line
- The tab of a decompressed file is named after the file without its compression suffix (`app.log`, not `app.log.zst.zst-view`), so VS Code picks its language from the remaining name
- Decompressing to disk writes to a hidden temporary file first, so a failure leaves no half-written file
- bzip2 is decoded by `unbzip2-stream`, one block at a time, instead of `seek-bzip`
- A file too large to preview offers "Decompress to …" and "Save As…" in its editor tab instead of a pop-up
- Requires VS Code 1.103.0 or newer, whose bundled Node.js includes Zstandard
- Tabs of decompressed files left open by version 1.0.x are not restored after updating; open the compressed file again

## [1.0.1] - 2026-01-29

### Fixed
- Fixed critical bug where large BZ2 files (multi-block) had corrupted/missing content
- Switched from buggy `bzip2` library to reliable `seek-bzip` library

### Added
- "Decompress Here" option to save decompressed file in the same folder
- "Save As..." option to choose custom save location
- "Open" and "Show in Folder" buttons after decompression
- Comprehensive unit test suite with golden master testing

### Changed
- Separated pure decompression logic into `src/decompressors/` for better testability

## [1.0.0] - 2025-09-10

### Added
- Support for viewing XZ files (`.xz`, `.tar.xz`) directly in VS Code
- Support for viewing bzip2 files (`.bz2`, `.tar.bz2`) directly in VS Code
- Automatic decompression on file click for all supported formats
- Native text editor integration with VS Code themes
- Modular provider architecture for extensible compression format support
- Large file handling with option to decompress to disk
