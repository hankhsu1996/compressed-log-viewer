# Change Log

All notable changes to the "Compressed Log Viewer" extension will be documented in this file.

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
