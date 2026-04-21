# Agent instructions

You are working on **`dynamodb-extract`**, an interactive CLI that downloads DynamoDB tables to JSON/NDJSON files and uploads files back into tables.

## Orient yourself — read these first

1. `README.md` — user-facing: what the tool does, how to set up `config.ts`, where downloads go.
2. `docs/superpowers/agent-handoff.md` — **start here if you're picking up work mid-flight.** Covers the current DI refactor, what's done, what's next, and which conventions to follow.
3. `docs/webiny-di-guide.md` — conventions for `@webiny/di`. Critical if you're touching any DI code. Read §1 and §6 in full; the short-name-reuse-with-alias pattern in §6 is easy to get wrong on first try.
4. `examples/S3Processor/` — reference implementation of a feature folder. The canonical shape to copy. Read all four files.
5. `docs/superpowers/specs/` — approved design docs.
6. `docs/superpowers/plans/` — implementation plans. Each plan has complete code; follow it step-by-step.
7. `docs/backlog.md` — open follow-ups the user hasn't picked up yet.

## Current state (2026-04-21)

- Branch `bruno/feat/di` — DI refactor spec + plan written, implementation not yet started.
- Plan: `docs/superpowers/plans/2026-04-21-di-refactor.md`. 7 tasks, each a commit.
- Spec: `docs/superpowers/specs/2026-04-21-di-refactor-design.md`.

When you're asked to continue the refactor, read `docs/superpowers/agent-handoff.md`, then invoke either `superpowers:subagent-driven-development` (preferred) or `superpowers:executing-plans` and work through the tasks.

## Critical conventions (non-negotiable)

- **`@webiny/di` naming:** abstraction token + `createImplementation` export share the same short name (e.g. `Config`, not `DefaultConfig` or `ConfigAbstraction`). The impl file uses a local rename alias — `import { Config as ConfigAbstraction } from "./abstractions/index.ts"` — so consumers never see "Abstraction" or "Default" suffixes anywhere. Types live on `AbstractionName.Interface` via namespace merge. See `examples/S3Processor/` for the canonical shape.
- **Feature area naming:** always ≥ 2 levels, e.g. `"Config/Config"`, `"Aws/ClientFactory"`, `"Commands/Download"`.
- **Feature `index.ts`:** exports the abstraction token + feature only. **Never re-export the `createImplementation` output** from the feature's public surface — that stays internal.
- **Method signatures:** options-object style (`run(options: X.RunOptions)`), not positional. Easier to extend later.
- **No inline structural types** in generics, params, or return types. Extract every non-primitive type to a named `interface` / `type`.
- **House rules:** every class method has an explicit `public` / `private` / `protected` modifier; single-line `if` / `for` always with braces.
- **Path alias** `~/* → src/*` is configured in `tsconfig.json` once the DI refactor's Task 1 lands. Use it for all intra-src imports.
- **Lifetime:** stateless services register as singletons (`.inSingletonScope()`).
- **No `ContainerToken` yet** — the DI refactor explicitly skips it. Don't introduce it without asking.
- **No `aws-sdk-client-mock`** — tests use `dynalite` (local DDB emulator). The vitest `globalSetup` starts dynalite and sets `AWS_ENDPOINT_URL_DYNAMODB`; the real `ClientFactory` impl routes at it via that env var without code changes.
- **`reflect-metadata`** is loaded by `@webiny/di` internally. Never `import "reflect-metadata"` in user code.

## Commands

```sh
yarn start          # launch the CLI
yarn ts-check       # TypeScript compile check (no emit)
yarn format:fix     # apply oxfmt formatter (run before committing)
yarn format:check   # assert formatted (read-only)
yarn test           # vitest run + coverage (added by Task 1)
yarn test:watch     # vitest watch (no coverage)
```

Project uses Yarn v4 (Berry) — `yarn install` sets that up via a `postinstall` hook. Node 24 ESM. TypeScript with `nodenext`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.

## Asking the user

- **One question at a time**, with your recommended answer. Don't batch questions — the user has told agents this explicitly.
- **For design-like decisions**, use `superpowers:brainstorming` or invoke the project-local `grill-me` skill (in `.claude/skills/grill-me/`) for relentless one-at-a-time decision-tree walkthroughs.
- **For implementation from a spec**, use `superpowers:writing-plans` then `subagent-driven-development` or `executing-plans`.
- **Before claiming work is complete**, use `superpowers:verification-before-completion` — run `yarn ts-check && yarn format:check && yarn test` and confirm output before making success claims.

## Things not to do

- Don't commit `config.ts` — it's gitignored and per-user. `config.example.ts` is the committed template.
- Don't commit files under `./data/` — also gitignored. That folder holds large exported tables.
- Don't add fallback handling / retries / error wrapping for scenarios that can't happen. Only validate at system boundaries.
- Don't "improve" type signatures on your own initiative with extra `as` casts or redundant annotations. The plan's code is already type-correct under strict mode.
- Don't introduce new abstractions or refactor outside the scope the user asked for. Flag and ask.
- Don't push to `origin` without explicit instruction. The remote tracks older states; anything pushed from this branch likely needs `--force`.
