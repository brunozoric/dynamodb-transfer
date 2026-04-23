# Upload Resume-From Design

**Date:** 2026-04-23  
**Status:** Approved

## Problem

When an upload fails partway through (e.g. a malformed line in NDJSON), the user fixes the source file and wants to re-run without re-uploading items that already landed in DynamoDB. There is currently no way to skip already-written items.

## Solution

Add a `startFrom` prompt to the upload flow. The user enters a 0-based index (JSON array) or 0-based line number (NDJSON). Items before that position are skipped. Default is `0` (upload everything).

## Flow

Upload flow after this change, in order:

1. Select source file (`prompter.sourceFile()`)
2. Select destination table (`prompter.table()`)
3. **New:** Enter start position (`prompter.startFrom()`) — default `0`
4. Confirm upload (`prompter.confirmUpload()`) — confirmation line notes start position when > 0
5. Attach log file if requested
6. `upload.run({ sourcePath, table, startFrom })`

## Prompter

### Abstraction (`abstractions/Prompter.ts`)

- Add `startFrom(): Promise<number>` to `IPrompter`.
- Add `startFrom: number` and `format: Paths.DownloadFormat` to `IConfirmUploadOptions`.

### Implementation (`Prompter.ts`)

- `startFrom()`: `input()` prompt, message `"Start from index (JSON) or line (NDJSON) — 0 to start from the beginning:"`, default `"0"`, validates non-negative integer.
- `confirmUpload()`: when `options.startFrom > 0`, append `, starting from index N` (JSON) or `, starting from line N` (NDJSON) to the summary line.

## Upload Abstraction (`abstractions/Upload.ts`)

- `IUploadRunOptions` gains `startFrom: number`.

## Upload Implementation (`Upload.ts`)

- `sendJson(client, tableName, sourcePath, startFrom)`: load full array (no slice), start loop at `i = startFrom`, initialize `written = startFrom`. Progress shows `Written ${written}/${items.length}` so the user sees cumulative position (e.g. `Written 76/100` when resuming from 75).
- `sendNdjson(client, tableName, sourcePath, startFrom)`: add `lineIndex` counter; skip lines where `lineIndex++ < startFrom`.

## Cli (`Cli.ts`)

- In `runUpload()`:
  - Call `const format = this.paths.detectFormat(sourcePath)` after source file selection.
  - Call `const startFrom = await this.prompter.startFrom()` before `confirmUpload`.
  - Pass `startFrom` and `format` to `confirmUpload`.
  - Pass `startFrom` to `upload.run()`.

## Out of scope

- Automatic checkpoint files.
- Validation of `startFrom` against actual file length (no double-read).
- Download resume (separate feature if ever needed).
