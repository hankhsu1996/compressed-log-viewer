# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that enables viewing of compressed log files directly in VS Code's native text editor. Supports XZ (.xz, .tar.xz), bzip2 (.bz2, .tar.bz2) and Zstandard (.zst, .tar.zst). The extension decompresses these files on the fly.

## Common Development Commands

**Build & Compilation:**

- `npm run compile` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for continuous compilation during development
- `npm run vscode:prepublish` - Prepare for publishing (runs compile)

**Code Quality:**

- `npm run lint` - Run ESLint on TypeScript files in src/
- `npm run format` - Format code with Prettier
- `npm test` - Compile, then run the compiled unit tests with mocha (needs the system `xz`, `bzip2` and `tar` tools; a missing one fails the run rather than skipping a format)

**Development:**

- Use the "Run Extension" launch configuration in VS Code for debugging
- The default build task is configured to run TypeScript watch mode

## Architecture

**Core Components:**

- `src/extension.ts` - Main extension entry point with activation/deactivation functions
- `src/decompressors/formats.ts` - The list of supported formats. A format is a name, a file suffix and one function from a stream of compressed chunks to a stream of decompressed chunks; adding a format is one entry here plus its file patterns in `package.json`. Also what every format shares: reading a file, previewing it up to a size limit (decoding stops once the limit is passed, so a large file is never held in memory), writing it to disk, and tar handling (`.tar` + suffix).
- `src/decompressors/` - Pure decompression code with no VS Code dependency, one file per format plus `tar.ts` and `chunks.ts` (reading a chunk stream a few bytes at a time, and feeding a Node transform). Every format decodes all concatenated members of a file and rejects data cut short anywhere.
- `src/decompressors/failure.ts` - Every way a file can fail to show is sorted into one `FailureReason` by the decoder that found it; `src/failureMessages.ts` turns a reason into the sentence the user reads. Library error text goes only to the output channel.
- `src/providers/` - The VS Code layer: `CompressedFileEditorProvider` is the custom editor (it swaps itself for a text document, or shows an `editorPage` explaining why it cannot, with buttons), `DecompressedDocumentProvider` supplies the text documents (one URI scheme; the document's path is the file's path without the format suffix, so the tab reads `app.log`, and the compressed file's URI is in the query). The editor hands the text it decoded to the document provider, so a file is decoded once. Errors are shown in the editor tab, never as pop-up notifications; closing the tab stops the work.

**Key Dependencies:**

- `lzma-native` - Native LZMA decompression for XZ files
- `unbzip2-stream` - bzip2 decompression, one block at a time (the `bzip2` package lost data across blocks; `seek-bzip` needs the whole file in memory and accepts a file cut short at a block boundary)
- Node's built-in `zlib` - Zstandard decompression (Node 22.15+, hence the VS Code 1.103 minimum)
- `tar-stream` - TAR archive extraction for `.tar.*` files
- A TypeScript declaration in `src/types/` for `lzma-native`, which ships none

**Extension Features:**

- Custom editor integration with compressed file associations (.xz, .bz2, .zst and their .tar.* forms)
- Direct file opening through VS Code's file explorer
- Output channel for debugging information

**File Structure:**

- `src/extension.ts` - Activation: registers the content provider and the custom editor
- `src/types/` - TypeScript type definitions for dependencies
- `src/test/` - Unit tests, compiled by `tsc -p src/test` into `out/test/` and run from there, the layout VS Code's extension template uses. Their own `tsconfig.json` adds the mocha globals, which the extension's build does not see. `formats.test.ts` runs the same cases against every format
- `out/` - Compiled JavaScript output (excluded from version control)
- `.vscode/` - VS Code workspace configuration including launch and tasks


## Git Workflow and Branching

**Branch Naming Conventions:**

- `feature/feature-name` - New functionality or enhancements
- `bugfix/issue-description` - Bug fixes
- `chore/task-description` - Maintenance tasks (dependencies, formatting, tooling)
- `hotfix/critical-fix` - Critical production fixes
- `release/version-number` - Release preparation (if using gitflow)

**Version Bumping:**

- Use release branches (`release/version-number`) for version bumps
- Never bump versions in feature branches (keeps features separate from releases)
- Always run `npm install` after version changes to sync package-lock.json
- Follow semantic versioning: MAJOR.MINOR.PATCH

**Git Workflow Best Practices:**

- NEVER commit directly to main branch (creates merge commits and non-linear history)
- Always use branches + PRs, even for small changes
- Exception: Internal documentation (CLAUDE.md, .gitignore) can be committed directly
- Keep git history linear by avoiding direct main commits

**Commit Messages:**

- Start commit messages with a verb (e.g., "Add", "Fix", "Update")
- Use bullet points for multiple changes in commit body
- Use `-` (hyphen) for bullet points, not `*` (follows Git/GitHub standard)
- Do NOT include Claude Code attribution footers in individual commits
- Use squash and merge for PRs to create clean commit history
- Include Claude Code attribution only in PR descriptions (will appear in final squashed commit)

## Release Workflow

**Complete Release Process:**

1. **Feature Development**: Work in feature branches, create PRs for all changes
2. **Release Preparation**: Create release branch (`release/x.y.z`)
   - Update version in package.json
   - Update CHANGELOG.md with release date
   - Run `npm install` to sync package-lock.json
   - Commit changes and create release PR
3. **Release Finalization**: 
   - Merge release PR to main
   - Switch to main and pull latest
   - Create git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
   - Push tag: `git push origin vX.Y.Z`
4. **GitHub Release**: Use `gh release create` with comprehensive release notes
5. **Marketplace Publishing**: Run `vsce publish` to publish to VS Code marketplace

**Extension Publishing:**

- Install vsce: `npm install -g @vscode/vsce`
- Login once: `vsce login <publisher-name>` (requires Azure DevOps PAT)
- Publish: `vsce publish` (automatically builds and uploads)
- Extension URL: `https://marketplace.visualstudio.com/items?itemName=<publisher>.<name>`
