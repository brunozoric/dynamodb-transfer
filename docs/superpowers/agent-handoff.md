# Agent handoff — DI refactor mid-flight

**Written:** 2026-04-21
**From:** Opus 4.7 (1M context) session
**To:** Next agent (likely Sonnet 4.6, regular context)

You're picking up a DI refactor of `dynamodb-extract`. The brainstorm and plan are finished; no code has been written yet against the plan. Your job, when the user asks, is to execute the plan.

---

## 1. Read these files first, in order

1. **`docs/superpowers/specs/2026-04-21-di-refactor-design.md`** — the approved design spec. Every decision is locked in here with rationale.
2. **`docs/superpowers/plans/2026-04-21-di-refactor.md`** — the 7-task implementation plan. Every task has full code and exact commands. Don't improvise; follow the plan.
3. **`docs/webiny-di-guide.md`** — the project's conventions for `@webiny/di`. Updated in this session (§1, §6) to document the short-name reuse + local rename alias trick.
4. **`docs/webiny-di-guide.md` §6** — canonical five-file templates plus a worked example (S3Processor). This is the source of truth for the convention; the `examples/` directory no longer exists.

Don't skim these. The naming convention is unusual (abstraction token and impl export share the same short name; the impl file uses a local rename alias) and is easy to get wrong on first try.

---

## 2. Current git state

**Branch:** `bruno/feat/di`

**Most recent commits (relevant to DI refactor):**
```
5c417d3 docs: add DI refactor implementation plan
325cf91 docs: add DI refactor design spec
ca72f94 docs(di-guide): document short-name reuse + rename alias convention
```

Everything before `ca72f94` is pre-DI-refactor (parallel scan, writable flag, etc. — all landed).

**Uncommitted working tree changes:** working tree is clean as of 2026-04-21.

---

## 3. What the refactor does (one-screen summary)

Moves four core services behind `@webiny/di` abstractions:

- **Config** — loads + validates + resolves per-table defaults. Returns `Config.ResolvedTable[]`.
- **ClientFactory** (area `Aws`) — `create(table) → DynamoDBDocumentClient`.
- **Download** (area `Commands`) — `run({ table, destPath, format, segments })`.
- **Upload** (area `Commands`, renamed from Send) — `run({ sourcePath, table })`.

Prompts (`src/prompts/*.ts`) and pure helpers (`src/lib/paths.ts`) **stay as free functions** (scope A). User said "eventually everything into DI" but deferred.

Tests live in `__tests__/` at the project root, using `vitest` + `dynalite` (local DDB emulator) + a shared `createTestContainer` harness. Dynalite is configured via vitest `globalSetup` which sets `AWS_ENDPOINT_URL_DYNAMODB` — the real `ClientFactory` impl then routes at the emulator with zero code-side changes.

---

## 4. Conventions (CRITICAL — do not improvise)

These all come from `docs/webiny-di-guide.md` (§6 is the canonical reference). The plan's code blocks already apply them, but if you need to write any code not in the plan, follow these:

### 4.1 Short-name reuse + local rename alias

The abstraction token and the `createImplementation` export **share the same short name**:

```ts
// abstractions/Config.ts — the TOKEN is just "Config"
export const Config = createAbstraction<IConfig>("Config/Config");
export namespace Config {
    export type Interface = IConfig;
    // Nested types (ResolvedTable, etc.) live here too
}
```

The impl file uses a **local rename alias** to avoid the name clash with its own exported const:

```ts
// Config.ts — implementation file
import { Config as ConfigAbstraction } from "./abstractions/index.ts";

class ConfigImpl implements ConfigAbstraction.Interface { ... }

// Exported with the SAME short name as the abstraction
export const Config = ConfigAbstraction.createImplementation({
    implementation: ConfigImpl,
    dependencies: []
});
```

Consumers always write:
- `dependencies: [Config]` (where Config is the abstraction token, not the impl)
- `private readonly config: Config.Interface`

They never see `ConfigAbstraction` — that alias is local to the impl file.

### 4.2 Feature index exports only abstraction + feature

```ts
// features/Config/index.ts
export { Config, ConfigError, defineConfig } from "./abstractions/index.ts";
export { ConfigFeature } from "./feature.ts";
```

The createImplementation export (`const Config` in `Config.ts`) is **never** re-exported from the feature's `index.ts`. Only the feature's `feature.ts` imports it, to register it.

### 4.3 Area naming — always at least two levels

Every abstraction and feature name has an area prefix:
- Tokens: `"Config/Config"`, `"Aws/ClientFactory"`, `"Commands/Download"`, `"Commands/Upload"`.
- Features: `"Config/ConfigFeature"`, `"Aws/AwsClientFeature"`, `"Commands/DownloadFeature"`, `"Commands/UploadFeature"`.

If you create another abstraction not in the plan, give it a two-level name.

### 4.4 House rules for impl files

- Every class method has an explicit `public` / `private` / `protected` modifier.
- Single-line `if` / `for` always use braces.
- No inline structural types in generics, params, returns — always extract to a named `interface` or `type`.
- Method signatures use **options objects**, not positional args (e.g. `run(options: Download.RunOptions)`).
- Interface naming convention: the internal interface is `IFeatureName`; the exported name is via namespace merge (`FeatureName.Interface`).
- Every constructor dep is `private readonly <name>: <Dep>Abstraction.Interface | Dep.Interface` depending on where types live.

### 4.5 Path alias

`~/* → src/*` is configured in `tsconfig.json` (Task 1). All intra-`src/` imports use `~/…` — never `../../…`.

### 4.6 Lifetime

All four abstractions in this refactor are **singletons**: `container.register(X).inSingletonScope()`. Documented in the plan; don't change unless the user asks.

### 4.7 No `ContainerToken`

We're skipping the `ContainerToken` convention (guide §4) because none of our four abstractions need the container. If you find yourself wanting to resolve the container inside an impl, **stop and tell the user** — it's a scope discussion.

### 4.8 Formatter — `oxfmt`

Run `yarn format:fix` before each commit. The format-check will otherwise flag new files. Format patterns are updated in Task 1 to include `__tests__/**/*.ts` and `vitest.config.ts`.

---

## 5. How to execute the plan

The user has NOT yet picked between the two execution modes. Ask them:

> Two execution options:
>
> 1. **Subagent-Driven** (recommended): I dispatch a fresh subagent per task, spec-compliance + code-quality review after each, fast iteration. Uses `superpowers:subagent-driven-development` skill.
> 2. **Inline Execution**: I execute tasks in this session with checkpoints for review. Uses `superpowers:executing-plans` skill.

Then invoke the corresponding skill and follow its flow. **Do not start coding before invoking the chosen skill.**

### Tips for subagent dispatch

If the user picks Subagent-Driven, note:

- Each task in the plan is one dispatch. Tasks are already sized appropriately (2-5 minutes per step).
- The plan's code blocks are the source of truth. Paste the full task text into the subagent prompt — don't ask the subagent to "read the plan file".
- Use cheap model (haiku or sonnet) for implementers; most tasks are mechanical code-writing.
- After each implementer's DONE report: dispatch a spec-compliance reviewer, then (if that passes) a code-quality reviewer. Don't skip either.
- Typical implementer deviation to watch for: they over-annotate types ("adding explicit types for safety"). Reject unprompted `as` casts and redundant annotations — the plan's code is already type-correct.

### Tips for inline execution

If Inline Execution:

- Work task-by-task. After each task, checkpoint: `yarn ts-check && yarn format:check && yarn test`. All green before moving on.
- Commit after each task (plan specifies the exact commit message).
- Each task is self-contained. If something breaks mid-task, fix within the task — don't merge task boundaries.

---

## 6. Things that tripped this session — avoid repeating

- **Don't invent naming.** I first proposed `DefaultConfig` / `ConfigAbstraction` / `IConfig` exported separately. All wrong per the user's convention. The plan's code blocks have the correct names; follow them verbatim.
- **Don't export the impl from a feature's `index.ts`.** Consumers register via the feature and resolve via the abstraction. The createImplementation const is internal to the feature folder.
- **Don't add `ContainerToken`** even if the guide's §7 bootstrap snippet shows it. It's YAGNI for this refactor.
- **Don't use `aws-sdk-client-mock`** for tests — we picked dynalite. (aws-sdk-client-mock isn't installed. Don't install it.)
- **`BatchWriteCommandOutput` annotation on `result` is NOT redundant** in `UploadImpl.sendChunk`. The loop-reassigned `let unprocessed` causes TS7022 (circular narrowing) without it. I verified this empirically. If you see a review suggest removing it, reject and keep the annotation.
- **When asking the user decisions, ask ONE question at a time** with your recommended answer. They explicitly told me to slow down after I batched questions early.
- **Every abstraction/feature name has at least two levels** (e.g. `"Config/Config"`, never bare `"Config"`). User feedback.
- **Method signatures use options objects** for extensibility. User feedback: "always objects, because it is easier to refactor and add more parameters later."
- **No inline structural types in signatures.** Extract to named types always. User feedback.
- **The `src/config/define.ts` shim is temporary.** Task 2 turns it into re-exports; Task 6 deletes it outright once every consumer has migrated. Don't skip Task 6's cleanup step.
- **`config.ts` at the repo root is gitignored and user-specific.** Task 6 Step 5 updates its import path; don't modify its `tables` content. `config.example.ts` mirrors the same shape but is committed.

---

## 7. Key library facts

- `@webiny/di` v0.2.3 is installed. `container.register(X)` reads the abstraction from the impl's metadata. `dependencies: [Abstraction]` takes abstraction tokens (NOT impl classes) — verified in the library types (`Dependency = Abstraction<any> | [Abstraction<any>, DependencyOptions]`).
- `container.registerInstance(Abs, instance)` takes precedence over `container.register(ImplClass)` in resolution — verified in library source `tryResolveFromCurrentContainer`. This is why `createTestContainer`'s "register all features, then registerInstance override" pattern works.
- Reflect-metadata is loaded by `@webiny/di` internally via side-effect import. **Never add your own** `import "reflect-metadata"` — it creates a duplicate metadata registry and breaks DI silently.

---

## 8. Config-related subtlety

`ConfigImpl` dynamic-imports `../../../config.js` (the user's gitignored `config.ts` at repo root). This means:

- Unit tests cannot easily exercise the real `ConfigImpl` — it would pick up whatever the user has in their local `config.ts`.
- Instead, Config tests inject a fake via `container.registerInstance(Config, { load: async () => [...tables] })` — this is what `createTestContainer({ tables: [...] })` does.
- The integration test for the real dynamic-import path is: `yarn start` actually runs, picks up `config.ts`, and works. That's verified manually in Task 6 Step 9. Don't add automation for it unless the user asks.

---

## 9. Verification commands (memorize these)

```sh
yarn ts-check       # TypeScript compilation
yarn format:fix     # oxfmt formatter (run before committing)
yarn format:check   # assert formatted (no writes)
yarn test           # vitest run + coverage (one-shot)
yarn test:watch     # vitest in watch mode (no coverage)
yarn start          # launch the CLI
```

Task 1 of the plan adds `test` and `test:watch`. Before Task 1 lands, only `yarn ts-check`, `yarn format:fix`, `yarn format:check`, `yarn start` exist.

---

## 10. When you finish the refactor

After Task 7's verification pass, invoke `superpowers:finishing-a-development-branch` to walk through merge / PR / discard options. Branch is `bruno/feat/di`; there's an `origin/master` remote-tracking ref from earlier sessions. The user chose to work on a feature branch for this one (different from earlier "work on main" direction) — respect that; don't push without explicit instruction.

---

Good luck. The plan is complete; the conventions are clear; the tests are concrete. Read §4 carefully once, then follow the plan step-by-step.
