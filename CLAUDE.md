# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that enables viewing of compressed log files directly in VS Code's native text editor. Supports XZ (.xz, .tar.xz) and BZ2 (.bz2, .tar.bz2) formats. The extension decompresses these files on-the-fly using native compression libraries.

## Common Development Commands

**Build & Compilation:**

- `npm run compile` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for continuous compilation during development
- `npm run vscode:prepublish` - Prepare for publishing (runs compile)

**Code Quality:**

- `npm run lint` - Run ESLint on TypeScript files in src/

**Testing:**

- Use the VS Code Extension Host for testing (F5 or Run Extension configuration)
- Extension tests are configured via `.vscode-test.mjs`

**Development:**

- Use the "Run Extension" launch configuration in VS Code for debugging
- The default build task is configured to run TypeScript watch mode

## Architecture

**Core Components:**

- `src/extension.ts` - Main extension entry point with activation/deactivation functions
- `CompressedFileProvider` class implements `vscode.TextDocumentContentProvider` for handling compressed file content
- Custom editor provider registered for seamless compressed file opening
- Multiple decompression paths: XZ (.xz, .tar.xz) and BZ2 (.bz2, .tar.bz2) formats

**Key Dependencies:**

- `lzma-native` - Native LZMA decompression for XZ files
- `bzip2` - Native BZIP2 decompression for BZ2 files
- `tar-stream` - TAR archive extraction for .tar.xz and .tar.bz2 files
- Custom TypeScript declarations in `src/types/` for external modules

**Extension Features:**

- Custom editor integration with compressed file associations (.xz, .tar.xz, .bz2, .tar.bz2)
- Direct file opening through VS Code's file explorer
- Output channel for debugging information

**File Structure:**

- `src/extension.ts` - Main extension logic
- `src/types/` - TypeScript type definitions for dependencies
- `out/` - Compiled JavaScript output (excluded from version control)
- `.vscode/` - VS Code workspace configuration including launch and tasks

The extension uses VS Code's TextDocumentContentProvider API to create virtual documents that display decompressed content while keeping the original compressed files intact.

## Git Workflow and Branching

**Branch Naming Conventions:**

- `feature/feature-name` - New functionality or enhancements
- `bugfix/issue-description` - Bug fixes
- `chore/task-description` - Maintenance tasks (dependencies, formatting, tooling)
- `hotfix/critical-fix` - Critical production fixes
- `release/version-number` - Release preparation (if using gitflow)

**Version Bumping:**

- Version bumps are typically done within feature branches or directly on main
- No separate branch needed for version bumps unless complex release process
- Bump version as part of the feature that warrants the increment
- Follow semantic versioning: MAJOR.MINOR.PATCH

**Commit Messages:**

- Start commit messages with a verb (e.g., "Add", "Fix", "Update")
- Use bullet points for multiple changes in commit body
- Do NOT include Claude Code attribution footers in individual commits
- Use squash and merge for PRs to create clean commit history
- Include Claude Code attribution only in PR descriptions (will appear in final squashed commit)
