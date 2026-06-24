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

## Source of Truth

Canonical repository: https://github.com/starismaaw/Sertifikat-Generator

GitHub is the source of truth. Do not rely on any agent memory as project state.

## Startup Protocol

Before editing files, run:

```bash
git status
git branch --show-current
git log --oneline -5
```

Then read this file first.

Do not scan the whole repository unless needed for the task.

If the task depends on latest remote state, run:

```bash
git fetch origin
```

Only run `git pull` when it is safe for the current branch and there are no uncommitted changes that could be overwritten.

## Git Workflow

### Branch-First Rule (MANDATORY)

Every task starts with a new branch. NEVER work on `main`.

```bash
git fetch origin
git switch -c <prefix/task-name> origin/main
```

### Branch Naming

- `feat/[description]` — new features
- `fix/[description]` — bug fixes
- `chore/[description]` — maintenance, deps, config
- `docs/[description]` — documentation only
- `review/[description]` — review/audit only (no code changes)

### Commit Convention

```
[type]: [short description in English]

Types: feat, fix, chore, docs, refactor, test, ci
```

### User-Verified Commit Rule

**Do NOT commit or push until user verifies and approves.**

After completing work:
1. Run validation (see below)
2. Report: branch, files changed, build result, testing checklist
3. Wait for user approval
4. Only then commit and push

## Design System
DESIGN.md

### Post-Merge / Squash-Merge Branch Rules

After a branch has been merged into `main`, especially through a squash merge, treat that branch as finished by default.

Do not continue feature or fix work on an old merged branch unless the user explicitly asks to keep using that branch.

Before making follow-up commits on an existing PR branch, run:

```bash
git fetch origin
git log --oneline --decorate --left-right HEAD...origin/main
```

If `origin/main` already contains the branch's feature as a squash merge or equivalent code change:

1. Prefer creating a new branch from latest `origin/main`.
2. Move only the new follow-up change onto that new branch.
3. Do not stack new commits on the old merged branch by default.
4. If the user explicitly asks to continue the old branch, first merge `origin/main`, resolve conflicts, validate, then make the new edit.

Safe follow-up workflow after a merged PR:

```bash
git fetch origin
git switch -c fix/<short-follow-up> origin/main
```

### Finish Protocol

When user approves:

```bash
# 1. Verify
npm run build
npm run lint
npm run test

# 2. Stage (explicit paths, NO git add .)
git add <specific-files>

# 3. Commit
git commit -m "[type]: [description]"

# 4. Push
git push -u origin HEAD

# 5. Do NOT merge to main
```

## Codex Worktree Rule

Codex Desktop may open this project inside an automatically managed worktree, for example:

```text
~/.codex/worktrees/<id>/
```

This is allowed.

If Codex starts in detached HEAD, do not edit files yet. First create a branch from `origin/main`:

```bash
git fetch origin
git switch -c codex/<short-task-name> origin/main
```

Then verify:

```bash
git status
git branch --show-current
```

The active branch must not be `main`, must not be `master`, and must not be detached before editing.

By default, Codex must not commit or push unless the user explicitly asks.

If the user explicitly asks Codex to commit and push, Codex may commit and push only the current non-main branch.

Codex must never push to `main` or `master`.

Do not treat the internal `.codex/worktrees/...` folder as the source of truth. GitHub remains the source of truth.

## Review-Only Mode

If the user asks for any of the following, the agent must not edit, commit, or push:

- review
- audit
- inspection
- diagnosis
- planning
- adversarial review
- mobile responsiveness review
- security review
- code review
- second opinion

In review-only mode:

- Do not edit files.
- Do not commit.
- Do not push.
- Do not reformat.
- Produce findings and a fix plan only.

## Handoff Protocol

Before switching agents or stopping implementation work, run:

```bash
git status
npm run build
npm run lint
npm run test
```

Then update:

```text
docs/agent-handoff.md
```

Review-only tasks do not need to update `docs/agent-handoff.md` unless the user explicitly asks.

Keep the handoff short and overwrite-style. Do not append long logs.

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

## Handoff Source of Truth

Each git worktree has its own copy of `docs/agent-handoff.md`. This is expected and safe.

A handoff file is only considered shared with other agents after it is committed and pushed to the agent's current branch.

Local handoff files are only valid for the current worktree and current branch.

When reviewing another agent's work, read the handoff from that agent's pushed branch:

```bash
git fetch origin
git show origin/<branch-name>:docs/agent-handoff.md
```

Do not assume the local `docs/agent-handoff.md` in another worktree is available, current, or relevant.

For Codex worktrees, do not read handoff directly from the internal worktree path unless the user explicitly provides that path.

Use GitHub/remote branch state as the source of truth.

## Handoff Conflict Rules

`docs/agent-handoff.md` is a short status snapshot, not a changelog.

Keep it overwrite-style and concise. Do not append long logs.

If `docs/agent-handoff.md` conflicts during merge or review:

1. Do not treat the conflict as a code conflict.
2. Prefer the handoff from the branch/agent whose work is currently being reviewed or merged.
3. Preserve only the latest relevant status.
4. Do not keep both long histories.
5. If unsure, resolve the code first, then regenerate a fresh short handoff.
6. After a squash-merged PR, regenerate `docs/agent-handoff.md` from the current task state.

## Completion Report

At the end of every task, report:

1. Branch name
2. Summary of changes
3. Files changed
4. Commands run
5. Build result (`npm run build`)
6. Lint result (`npm run lint`)
7. Test result (`npm run test`)
8. Whether anything was committed
9. Whether anything was pushed
10. Remaining risks
11. Recommended next step

## Safety Rules

- Do not commit `.env`, `.env.local`, or secrets.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.
- Do not modify Supabase production config, auth, or storage without explicit approval.
- Do not refactor unrelated files.
- Preserve existing Bahasa Indonesia UI and formal style.
- Inspect only files needed for the task.
- Never `git add .` — always specific paths.
- Merges to `main` via PR only, reviewed by user.
