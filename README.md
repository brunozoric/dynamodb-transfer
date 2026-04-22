# dynamodb-extract

Interactive CLI for downloading and uploading DynamoDB tables.

## Requirements

- Node.js 24+
- Yarn v4 (Berry) — set up automatically by the `postinstall` script on first `yarn install`.

## Setup

1. Install dependencies:
   ```sh
   yarn install
   ```
2. Copy the example config and edit it with your tables:

   ```sh
   cp config.example.ts config.ts
   ```

   `config.ts` is gitignored; your changes stay local.

   Each table entry needs:
   - `name` — the real DynamoDB table name.
   - `description` — ≤ 40 characters, unique across entries. Used as the exported filename.
   - `writable` — `true` / `false`. Tables with `writable: false` never appear in the Send destination list, so accidental writes are impossible. Flip to `true` only for tables you intentionally want as restore targets.
   - `awsProfile` / `region` — optional; inherit the top-level defaults when omitted.

3. The AWS profile referenced in `config.ts` must resolve to credentials with the permissions you need (read for download, write for send). The client uses the standard Node provider chain, so `~/.aws/credentials`, `~/.aws/config` (including SSO), environment variables, and container/IMDS roles all work — run `aws sso login --profile <name>` first if you use SSO.

## Usage

```sh
yarn start
```

You'll be prompted for the action (download / send / exit), then the target table or source file.

**Download** also asks for a file format:

- `NDJSON` (default) — one item per line, streamed to disk. Recommended for large tables: bounded memory, fast.
- `JSON array` — single pretty-printed array. Easier to eyeball in a text editor; holds the whole result in memory.

**Send** auto-detects the format from the source file's extension (`.ndjson` vs `.json`). Two safety gates on the write path:

- Only tables with `writable: true` appear in the destination list — non-writable tables can't be picked.
- The confirmation prompt requires typing the destination table name exactly; y/N isn't accepted.

## Where downloads are stored

`./data/`. Filename is the camelCased description plus the format's extension:

- `"Webiny default"` + NDJSON → `data/webinyDefault.ndjson`
- `"Webiny default"` + JSON → `data/webinyDefault.json`

The `data/` directory is gitignored.
