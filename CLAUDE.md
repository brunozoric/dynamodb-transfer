# Claude Code instructions

Read `AGENTS.md` first — it has the project overview, current state, conventions, and commands.

## Claude-specific notes

- `.claude/skills/` contains project-local skills: `grill-me`, `design-an-interface`, `tdd`, `improve-codebase-architecture`, `ubiquitous-language`, `triage-issue`, `to-issues`, `to-prd`, `edit-article`, `git-guardrails-claude-code`, `write-a-skill`. The one most used in this project so far is **`grill-me`** (relentless one-at-a-time interview for plan/design work).
- Follow `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development` (or `executing-plans`) for any multi-step work. The user has been consistent about wanting brainstorm → spec → plan → execute with approvals at each gate.
- `docs/superpowers/agent-handoff.md` is a detailed handoff written at the end of a session where Opus 4.7 (1M) handed off to Sonnet 4.6. It covers gotchas specific to this codebase (naming convention, `@webiny/di` quirks, test harness shape, what not to improvise). Read it if you see references to "DI refactor" in user messages.
- User prefers ask-one-question-at-a-time with a recommended answer. Don't batch design questions.
