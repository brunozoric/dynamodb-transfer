# Backlog

Open ideas for dynamodb-extract, grouped by priority. Ticked items are done; unticked are candidates.

## Small polish

- [ ] `send.ts` NDJSON progress shows `"Written N items..."` with no total. `wc -l` up front to get `N/M` parity with the JSON path.
- [ ] Config error paths use zod's dot style (`tables.1.description`). Translate to bracket style (`tables[1].description`) for consistency with the spec's example.
- [ ] `data/.gitkeep` is committed so the (gitignored) `data/` dir survives a fresh clone. Harmless but noted.
- [ ] Spec and plan docs don't yet reflect the NDJSON feature (commit `af3762d`). Amendment block in both.
- [ ] Add a `LICENSE` file. `package.json` declares MIT but there's no license file at the root.

## Credentials / auth

- [x] Switch `fromIni` to `fromNodeProviderChain` so SSO, env vars, and container-role auth work out of the box.

## Performance / reliability (deferred from the original spec)

- [ ] Exponential backoff + jitter on BatchWrite's unprocessed-items retry. Current fixed 500 ms thrashes under sustained throttling.
- [ ] Concurrent BatchWrites in `send` (N in-flight requests). Big speedup on restore.
- [ ] Parallel scan in `download` via `Segment` / `TotalSegments`. N× faster on large tables.
- [ ] Resume from `LastEvaluatedKey` by persisting the last key next to the export. Real reliability win for multi-hour downloads.

## UX

- [ ] Dry-run / preview on send — show item count (and maybe a sample key or two) before the typed confirmation. Pairs naturally with the existing safety.

## Testing

- [ ] Add a test runner (vitest) and cover the pure bits: `toCamelCase`, `detectFormat`, zod `ConfigSchema`, `resolveDestPath` basename logic. These are mechanical functions with no AWS dependency.

## Out of scope (for reference — do not pick up without a strong reason)

- Non-interactive CLI flags (`--download <description>`). The guided flow is the product; flags are scope creep unless you need scripting.
- Streaming the JSON-array format. NDJSON already solves the memory footprint; streaming a `[...]` array is more code for a format that exists to be eyeballed in an editor.
