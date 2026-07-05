# Supabase Keep-Alive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions scheduled workflow that pings Supabase directly so the Free Plan project never accumulates 7 days of zero database activity.

**Architecture:** A standalone Node ESM script (`scripts/keep-supabase-alive.mjs`) uses `@supabase/supabase-js` (already a project dependency) to run a lightweight `SELECT id FROM pakta_events LIMIT 1` using a service-role key. A GitHub Actions workflow (`.github/workflows/keep-supabase-alive.yml`) runs this script twice a week (Mon/Thu) plus on manual `workflow_dispatch`, using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secrets. No application code, UI, or Vercel config changes.

**Tech Stack:** Node.js (ESM `.mjs`, matches existing `scripts/copy-fonts.mjs` pattern), `@supabase/supabase-js` v2, GitHub Actions.

**Reference spec:** `docs/superpowers/specs/2026-07-05-supabase-keep-alive-design.md`

---

### Task 1: Keep-alive script

**Files:**
- Create: `scripts/keep-supabase-alive.mjs`

- [ ] **Step 1: Write the script**

```js
// scripts/keep-supabase-alive.mjs
// Ping Supabase secara berkala supaya project Free Plan tidak di-pause
// karena 7 hari tanpa aktivitas database. Dijalankan oleh GitHub Actions
// (.github/workflows/keep-supabase-alive.yml), bukan bagian dari aplikasi.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'keep-supabase-alive: env var SUPABASE_URL dan/atau SUPABASE_SERVICE_ROLE_KEY belum di-set'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await supabase.from('pakta_events').select('id').limit(1)

if (error) {
  console.error('keep-supabase-alive: query gagal —', error.message)
  process.exit(1)
}

console.log(
  `keep-supabase-alive: OK — pakta_events query berhasil (${data.length} baris) pada ${new Date().toISOString()}`
)
```

- [ ] **Step 2: Verify the missing-env-var error path (no real credentials needed)**

Run: `node scripts/keep-supabase-alive.mjs`
Expected output (stderr) and exit code:
```
keep-supabase-alive: env var SUPABASE_URL dan/atau SUPABASE_SERVICE_ROLE_KEY belum di-set
```
Run `echo $?` immediately after — expected: `1`

This proves the script's error-handling path (the safety net that makes workflow failures visible instead of silent) works correctly, without needing real Supabase credentials.

- [ ] **Step 3: Syntax/import sanity check**

Run: `node --check scripts/keep-supabase-alive.mjs`
Expected: no output, exit code `0` (confirms valid ESM syntax before it ever runs in CI)

- [ ] **Step 4: Commit**

```bash
git add scripts/keep-supabase-alive.mjs
git commit -m "$(cat <<'EOF'
feat: add Supabase keep-alive script

Lightweight query script to prevent Supabase Free Plan auto-pause
after 7 days of DB inactivity. Run by a scheduled GitHub Actions
workflow, not part of the application bundle.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: GitHub Actions scheduled workflow

**Files:**
- Create: `.github/workflows/keep-supabase-alive.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Keep Supabase Alive

on:
  schedule:
    # Senin & Kamis, 03:00 UTC (10:00 WIB) — jarak maks 4 hari, di bawah ambang 7 hari Supabase
    - cron: '0 3 * * 1,4'
  workflow_dispatch:

jobs:
  ping-supabase:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Ping Supabase
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/keep-supabase-alive.mjs
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/keep-supabase-alive.yml')); print('valid')"`
Expected: `valid`

(If `python3`/`pyyaml` isn't available locally, skip this and rely on Step 3 in Task 3 instead — GitHub itself will reject an invalid workflow file when pushed.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/keep-supabase-alive.yml
git commit -m "$(cat <<'EOF'
feat: schedule keep-supabase-alive via GitHub Actions

Runs the keep-alive script Mon/Thu at 03:00 UTC plus on manual
workflow_dispatch. Requires SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY GitHub Actions secrets (added separately
by the repo owner — not part of this commit).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Whole-repo verification and handoff

**Files:**
- Modify: `docs/agent-handoff.md`

- [ ] **Step 1: Run project build/test to confirm no regressions**

Run: `npm run build`
Expected: exits 0 (existing bundle-size warning is pre-existing/unrelated)

Run: `npm run test`
Expected: all existing tests still pass (this change adds no application code, so the count should be unchanged from before this plan)

- [ ] **Step 2: Confirm no lint script regression (project has none — documented, not a gap from this task)**

Run: `npm run lint`
Expected: `npm error Missing script: "lint"` (matches pre-existing project state — do not add a lint script as part of this task, that would be scope creep)

- [ ] **Step 3: Update `docs/agent-handoff.md`**

Replace its content with:

```markdown
## Agent Handoff

**Branch:** `claude/busy-newton-5432fa`
**Task:** Cegah Supabase Free Plan project auto-pause (7 hari tanpa aktivitas DB) via GitHub Actions scheduled keep-alive, mengikuti brainstorming → spec → plan.
**Last agent:** Claude Sonnet 5 (Claude Code)
**Status:** Kode SELESAI (script + workflow dibuat, build/test lolos). **Belum di-push/PR** — menunggu instruksi eksplisit user. Workflow TIDAK akan berhasil jalan sampai user menambahkan 2 GitHub Actions secrets (lihat "Next Step").

### Spec & Plan
- `docs/superpowers/specs/2026-07-05-supabase-keep-alive-design.md`
- `docs/superpowers/plans/2026-07-05-supabase-keep-alive.md`

### Files Changed
- `scripts/keep-supabase-alive.mjs` — script baru, query ringan `pakta_events` pakai service role key
- `.github/workflows/keep-supabase-alive.yml` — workflow baru, cron Senin & Kamis 03:00 UTC + `workflow_dispatch`

### Commands Run
```
node scripts/keep-supabase-alive.mjs   # tanpa env var → exit 1 dengan pesan error yang jelas (PASS, sesuai desain)
node --check scripts/keep-supabase-alive.mjs   # syntax valid
npm run build   # PASS
npm run test    # PASS, tidak ada test baru/berubah (script ini di luar cakupan vitest, sesuai spec)
npm run lint    # tidak ada script lint (pre-existing)
```

### Validation
- Build: ✅
- Lint: tidak ada script (pre-existing)
- Test: ✅ (jumlah tidak berubah dari sebelum task ini)
- Workflow end-to-end (query sukses ke Supabase asli) **belum diverifikasi** — butuh secrets GitHub + trigger manual, tidak bisa dilakukan dari sandbox ini (tidak ada kredensial Supabase).

### Known Issues
- Belum ada verifikasi end-to-end bahwa query benar-benar sukses ke Supabase project asli (butuh kredensial nyata + secrets GitHub yang belum ditambahkan).

### Next Step
1. User menambahkan 2 secrets di GitHub repo → Settings → Secrets and variables → Actions:
   - `SUPABASE_URL` (sama dengan `VITE_SUPABASE_URL` di Vercel)
   - `SUPABASE_SERVICE_ROLE_KEY` (sama dengan env Vercel, dari Supabase dashboard → Settings → API)
2. Setelah user minta eksplisit "commit and push"/"push this branch", push branch ini dan buka PR.
3. Setelah PR/branch di GitHub dan secrets sudah ada, trigger workflow manual sekali via tab Actions → "Run workflow" (workflow_dispatch) untuk verifikasi end-to-end sebelum mengandalkan jadwal cron.
```

- [ ] **Step 4: Commit**

```bash
git add docs/agent-handoff.md
git commit -m "$(cat <<'EOF'
docs: update handoff — Supabase keep-alive implementation done

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
