# Workflow Orchestration

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

## 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

## 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

## 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

## 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Rule 5 — Use the model only for judgment calls

Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory

Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them

If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write

Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior

Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step

Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree

Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud

"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

---

# Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

---

# Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

---

# Agent Instructions (Claude Code / Codex / CommandCode)

This file is the canonical instruction file for all coding agents on this project.

Canonical repository: https://github.com/starismaaw/Sertifikat-Generator/

GitHub is the source of truth. Do not rely on prior agent memory as project state.

## Automatic Start Protocol

At the beginning of every session, before editing files, automatically run:

```bash
git status
git branch --show-current
git log --oneline -10
git fetch origin
```

Then read:

```text
AGENTS.md
docs/agent-handoff.md
```

Summarize briefly:

- current branch
- working tree status
- whether current branch is `main`, `master`, detached, or safe non-main branch
- latest relevant handoff
- task scope
- whether the task is implementation mode or review-only mode

Do not edit files until this context is understood.

Only run `git pull` when it is safe for the current branch and there are no uncommitted changes that could be overwritten.

If there are unclear local changes at session start, stop and ask before overwriting, reverting, stashing, or pulling.

## Working Rules

Follow `AGENTS.md` for all project rules.

Important reminders:

- Keep changes surgical and focused.
- Preserve the current Bahasa Indonesia UI and formal government style.
- Do not refactor unrelated files.
- Do not commit secrets or `.env*` files.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.
- Do not modify Supabase production database, auth, storage, or RLS without explicit approval.
- Do not modify Vercel deployment settings without explicit approval.
- Do not modify auth/security-sensitive logic without explicit approval.
- For non-trivial tasks, write a short plan first and verify after each significant step.

## Branch Safety

`main` is the protected production branch.

Agent must not edit, commit, or push code changes directly on `main` unless the user explicitly says:

```text
You may edit main directly.
```

For any code or documentation change, create a branch first:

```bash
git fetch origin
git switch -c feat/<short-name> origin/main
```

Use the correct branch prefix:

- `feat/<short-name>` for features
- `fix/<short-name>` for bug fixes
- `docs/<short-name>` for documentation
- `chore/<short-name>` for maintenance/config
- `refactor/<short-name>` for internal refactors
- `test/<short-name>` for tests

After finishing, push the branch and ask the user before merging to `main`.

## Handoff Source of Truth

Each git worktree has its own copy of `docs/agent-handoff.md`. This is expected and safe.

Treat the local `docs/agent-handoff.md` as valid only for the current worktree and current branch.

When reviewing another agent's work, read the handoff from that agent's pushed branch, not from the internal worktree path:

```bash
git fetch origin
git show origin/<branch-name>:docs/agent-handoff.md
```

If a handoff conflict appears during merge:

1. Resolve code conflicts first.
2. Treat `docs/agent-handoff.md` as a status snapshot, not source code.
3. Keep only the latest relevant status for the branch being merged.
4. If unsure, regenerate a fresh short handoff after validation.

## Finish Protocol

At the end of a task, follow the finish protocol from `AGENTS.md`.

Run validation:

```bash
npm run build
npm run lint
npm run test
git status
```

Then update:

```text
docs/agent-handoff.md
```

By default, do not commit or push.

Only commit and push if the user explicitly says one of:

- `commit and push`
- `you may commit and push`
- `push this branch`
- `create a commit`
- `commit this`
- `push to GitHub`

If the user explicitly approved commit/push, agent may commit and push only the current non-main branch if:

- the task is complete
- build passes
- no blocking lint errors exist
- changed files are relevant
- no secrets are included

Agent must never commit directly to `main` or `master`.

Agent must never push to `main` or `master`.

Agent must not merge to `main` without explicit approval.

## Handoff Format

Before agent stops work, hits limits, or user switches agent during implementation:

1. Stop starting new work.
2. Run:

```bash
git status
npm run build
npm run lint
npm run test
```

3. Update:

```text
docs/agent-handoff.md
```

Use this format:

```markdown
## Agent Handoff

**Branch:**
**Task:**
**Last agent:**
**Status:**

### Files Changed
- ...

### Commands Run
- ...

### Validation
- Build:
- Lint:
- Test:

### Known Issues
- ...

### Next Step
- ...
```

Include: branch, task, what changed, files touched, commands run, build/lint/test result, known issues, exact next step, and whether changes were committed/pushed or left local.

If lint reports warnings, state that honestly. Do not say "clean" unless there are zero warnings.
