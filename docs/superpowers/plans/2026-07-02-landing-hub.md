# Landing Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "home" view (which renders the certificate event list directly) with a neutral Landing Hub that lets the user pick between two equal modules — Sertifikat Generator and Pakta Integritas — then move the existing event list behind a new `sertifikat` route.

**Architecture:** Add a `sertifikat` variant to the existing hash-based `View` union in `AppRouter.tsx`. Add a new presentational component `Hub.tsx` (two clickable cards, no data fetching) rendered on the `home` view. Rewire `App.tsx` to render `Hub` on `home` and the existing `EventList` on `sertifikat`, and extend the breadcrumb builder to insert a "Sertifikat Generator" crumb. Make the topbar logo a clickable "go home" button. Drop the now-redundant "Pakta Integritas" button from `EventList`.

**Tech Stack:** React 18 + TypeScript, hash-based router (`src/components/AppRouter.tsx`, no external router library), Vitest + @testing-library/react (already a devDependency, not yet used for component tests in this repo — first usage here), plain CSS with `sg-*` class convention (`src/styles/apple-design.css`).

---

## File Structure

- **Modify** `src/components/AppRouter.tsx` — add `sertifikat` view variant; export `parseHash` (currently private) so it's directly unit-testable.
- **Create** `src/components/Hub.tsx` — new presentational component, two module cards.
- **Modify** `src/App.tsx` — render `Hub` on `home`, `EventList` on `sertifikat`; extend breadcrumbs.
- **Modify** `src/components/AppTopbar.tsx` — logo becomes a button that navigates home.
- **Modify** `src/components/EventList.tsx` — remove the "Pakta Integritas" button (dead now that Hub owns that entry point).
- **Modify** `src/styles/apple-design.css` — add `.sg-hub*` rules; adjust `.sg-topbar-logo` for button semantics.
- **Create** `tests/appRouter.test.ts` — unit tests for `parseHash`/`navigate` covering the new `sertifikat` view.
- **Create** `tests/Hub.test.tsx` — component test for the two cards and their navigation calls.
- **Create** `tests/AppTopbar.test.tsx` — component test for the logo-as-home-button behavior.

`App.tsx` wiring and the `EventList.tsx` button removal have no automated test in this plan — there's no existing test harness for `App.tsx` (it pulls in `PaktaAdminProvider`, Supabase-backed contexts, etc.) and adding one is disproportionate to a one-line JSX removal / render-branch change. Both are covered by the manual verification checklist in Task 6, matching the manual-only verification already approved in the spec.

---

### Task 1: Add the `sertifikat` view to the router

**Files:**
- Modify: `src/components/AppRouter.tsx`
- Test: `tests/appRouter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/appRouter.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { navigate, parseHash } from '../src/components/AppRouter';

beforeEach(() => {
  window.location.hash = '';
});

describe('AppRouter — sertifikat view', () => {
  it('parses hash "sertifikat" into the sertifikat view', () => {
    window.location.hash = 'sertifikat';
    expect(parseHash()).toEqual({ name: 'sertifikat' });
  });

  it('parses an empty hash into the home view (the hub)', () => {
    window.location.hash = '';
    expect(parseHash()).toEqual({ name: 'home' });
  });

  it('navigate({ name: "sertifikat" }) sets the hash to "sertifikat"', () => {
    navigate({ name: 'sertifikat' });
    expect(window.location.hash).toBe('#sertifikat');
  });

  it('navigate({ name: "home" }) clears the hash', () => {
    window.location.hash = 'sertifikat';
    navigate({ name: 'home' });
    expect(window.location.hash).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/appRouter.test.ts`
Expected: FAIL — `parseHash` is not exported from `../src/components/AppRouter` (and `sertifikat` is not a valid view yet).

- [ ] **Step 3: Implement the router change**

In `src/components/AppRouter.tsx`, update the `View` union (add the new variant after `'home'`):

```ts
export type View =
  | { name: 'home' }
  | { name: 'sertifikat' }
  | { name: 'editor'; eventId: string }
  | { name: 'generate'; eventId: string }
  | { name: 'pakta-admin' }
  | { name: 'pakta-editor'; eventId: string }
  | { name: 'pakta-dashboard'; eventId: string }
  | { name: 'pakta-signer'; eventId: string };
```

Change `function parseHash(): View {` to `export function parseHash(): View {`, and add the `sertifikat` case (order doesn't matter, placed after the `pakta-admin` check for readability):

```ts
export function parseHash(): View {
  const h = window.location.hash.replace(/^#/, '');
  const [name, id] = h.split('/');
  if (name === 'sertifikat')             return { name: 'sertifikat' };
  if (name === 'editor' && id)           return { name: 'editor', eventId: id };
  if (name === 'generate' && id)         return { name: 'generate', eventId: id };
  if (name === 'pakta-admin')            return { name: 'pakta-admin' };
  if (name === 'pakta-editor' && id)     return { name: 'pakta-editor', eventId: id };
  if (name === 'pakta-dashboard' && id)  return { name: 'pakta-dashboard', eventId: id };
  if (name === 'pakta' && id)            return { name: 'pakta-signer', eventId: id };
  return { name: 'home' };
}
```

Update `navigate()` to set the hash for the new view:

```ts
export function navigate(view: View): void {
  if (view.name === 'home')              window.location.hash = '';
  else if (view.name === 'sertifikat')  window.location.hash = 'sertifikat';
  else if (view.name === 'pakta-admin') window.location.hash = 'pakta-admin';
  else if (view.name === 'pakta-signer') window.location.hash = `pakta/${view.eventId}`;
  else window.location.hash = `${view.name}/${view.eventId}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/appRouter.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/AppRouter.tsx tests/appRouter.test.ts
git commit -m "feat(router): add sertifikat view for the landing hub redesign"
```

---

### Task 2: Create the `Hub` component

**Files:**
- Create: `src/components/Hub.tsx`
- Modify: `src/styles/apple-design.css`
- Test: `tests/Hub.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/Hub.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const navigateMock = vi.fn();
vi.mock('../src/components/AppRouter', () => ({
  navigate: (...args: unknown[]) => navigateMock(...args),
}));

import { Hub } from '../src/components/Hub';

beforeEach(() => navigateMock.mockClear());

describe('Hub', () => {
  it('renders both module cards', () => {
    render(<Hub />);
    expect(screen.getByRole('button', { name: 'Sertifikat Generator' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pakta Integritas' })).toBeInTheDocument();
  });

  it('navigates to the sertifikat view when the Sertifikat Generator card is clicked', () => {
    render(<Hub />);
    fireEvent.click(screen.getByRole('button', { name: 'Sertifikat Generator' }));
    expect(navigateMock).toHaveBeenCalledWith({ name: 'sertifikat' });
  });

  it('navigates to the pakta-admin view when the Pakta Integritas card is clicked', () => {
    render(<Hub />);
    fireEvent.click(screen.getByRole('button', { name: 'Pakta Integritas' }));
    expect(navigateMock).toHaveBeenCalledWith({ name: 'pakta-admin' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/Hub.test.tsx`
Expected: FAIL — cannot find module `../src/components/Hub`.

- [ ] **Step 3: Implement `Hub.tsx`**

Create `src/components/Hub.tsx`:

```tsx
import { navigate } from './AppRouter';

function SertifikatIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="30" height="30" rx="4" />
      <path d="M11 14h18M11 19h18M11 24h12" />
      <circle cx="29" cy="28" r="4" />
      <path d="M26 32l-2 4 5-2 5 2-2-4" />
    </svg>
  );
}

function PaktaIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5h13l6 6v24a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M24 5v6h6" />
      <path d="M13 29c2-3 5-4 7-2M13 29l9-9c1-1 3 1 2 2l-9 9" />
    </svg>
  );
}

export function Hub() {
  return (
    <div className="sg-hub">
      <h1 className="sg-hub-title">Pilih modul</h1>
      <div className="sg-hub-grid">
        <button
          type="button"
          className="sg-hub-card"
          onClick={() => navigate({ name: 'sertifikat' })}
        >
          <div className="sg-hub-card-icon"><SertifikatIcon /></div>
          <span className="sg-hub-card-label">Sertifikat Generator</span>
        </button>
        <button
          type="button"
          className="sg-hub-card"
          onClick={() => navigate({ name: 'pakta-admin' })}
        >
          <div className="sg-hub-card-icon"><PaktaIcon /></div>
          <span className="sg-hub-card-label">Pakta Integritas</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/Hub.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Add Hub styles**

In `src/styles/apple-design.css`, add a new section right after the `.sg-topbar*` rules (after the block ending at the `.sg-breadcrumb` rule, i.e. right before line `988: .sg-breadcrumb {` — insert above it):

```css
/* ── Hub (landing) ──────────────────────────────────────────── */

.sg-hub {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 80px 24px;
}

.sg-hub-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--color-ink);
  text-align: center;
  margin-bottom: 32px;
}

.sg-hub-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

@media (max-width: 600px) {
  .sg-hub-grid { grid-template-columns: 1fr; }
}

.sg-hub-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  border-radius: 16px;
  padding: 48px 24px;
  font-family: inherit;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.1s ease;
}

.sg-hub-card:hover {
  box-shadow: var(--shadow-elevated);
}

.sg-hub-card:active {
  transform: scale(0.98);
}

.sg-hub-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.sg-hub-card-icon {
  width: 88px;
  height: 88px;
  border-radius: 20px;
  background: var(--color-canvas-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sg-hub-card-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-ink);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Hub.tsx src/styles/apple-design.css tests/Hub.test.tsx
git commit -m "feat(hub): add Landing Hub component with Sertifikat/Pakta cards"
```

---

### Task 3: Make the topbar logo a "go home" button

**Files:**
- Modify: `src/components/AppTopbar.tsx`
- Modify: `src/styles/apple-design.css`
- Test: `tests/AppTopbar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/AppTopbar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const navigateMock = vi.fn();
vi.mock('../src/components/AppRouter', () => ({
  navigate: (...args: unknown[]) => navigateMock(...args),
}));

import { AppTopbar } from '../src/components/AppTopbar';

beforeEach(() => navigateMock.mockClear());

describe('AppTopbar', () => {
  it('navigates to the home (hub) view when the logo is clicked', () => {
    render(<AppTopbar breadcrumbs={[{ label: 'Beranda', active: true }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Beranda' }));
    expect(navigateMock).toHaveBeenCalledWith({ name: 'home' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/AppTopbar.test.tsx`
Expected: FAIL — no element with role `button` and accessible name `Beranda` from the logo (the only `Beranda` element is the breadcrumb's `active` span, which is not a button, so this specific query fails to find the logo button).

- [ ] **Step 3: Implement the change**

In `src/components/AppTopbar.tsx`, replace:

```tsx
      <div className="sg-topbar-logo">S</div>
```

with:

```tsx
      <button
        type="button"
        className="sg-topbar-logo"
        onClick={() => navigate({ name: 'home' })}
        aria-label="Beranda"
      >
        S
      </button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/AppTopbar.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Update logo styles for button semantics**

In `src/styles/apple-design.css`, replace the `.sg-topbar-logo` rule:

```css
.sg-topbar-logo {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--color-secondary);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
}
```

with:

```css
.sg-topbar-logo {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--color-secondary);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
  border: none;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.1s ease;
}

.sg-topbar-logo:hover {
  opacity: 0.85;
}

.sg-topbar-logo:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/AppTopbar.tsx src/styles/apple-design.css tests/AppTopbar.test.tsx
git commit -m "feat(topbar): make logo a button that navigates to the hub"
```

---

### Task 4: Wire the Hub and sertifikat view into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

No automated test for this task — see the "File Structure" note above. Verified manually in Task 6.

- [ ] **Step 1: Import `Hub`**

In `src/App.tsx`, add to the imports (alongside the existing `EventList` import):

```tsx
import { Hub } from './components/Hub';
```

- [ ] **Step 2: Update the breadcrumbs builder**

Replace the whole `breadcrumbs` block:

```tsx
  const breadcrumbs: BreadcrumbItem[] = (() => {
    if (isPaktaView) return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: 'Pakta Integritas', view: { name: 'pakta-admin' } },
      ...(view.name === 'pakta-editor' ? [{ label: 'Editor Templat', active: true as const }] : []),
      ...(view.name === 'pakta-dashboard' ? [{ label: 'Dashboard', active: true as const }] : []),
    ];
    if (view.name === 'home') return [{ label: 'Beranda', active: true }];
    const ev = getEvent(view.eventId);
    const evLabel = ev?.nama ?? 'Kegiatan';
    if (view.name === 'editor') return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: evLabel, view: { name: 'generate', eventId: view.eventId } },
      { label: 'Editor templat', active: true },
    ];
    if (view.name === 'generate') return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: evLabel, active: true },
    ];
    return [{ label: 'Beranda', active: true }];
  })();
```

with:

```tsx
  const breadcrumbs: BreadcrumbItem[] = (() => {
    if (isPaktaView) return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: 'Pakta Integritas', view: { name: 'pakta-admin' } },
      ...(view.name === 'pakta-editor' ? [{ label: 'Editor Templat', active: true as const }] : []),
      ...(view.name === 'pakta-dashboard' ? [{ label: 'Dashboard', active: true as const }] : []),
    ];
    if (view.name === 'home') return [{ label: 'Beranda', active: true }];
    if (view.name === 'sertifikat') return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: 'Sertifikat Generator', active: true },
    ];
    const ev = getEvent(view.eventId);
    const evLabel = ev?.nama ?? 'Kegiatan';
    if (view.name === 'editor') return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: 'Sertifikat Generator', view: { name: 'sertifikat' } },
      { label: evLabel, view: { name: 'generate', eventId: view.eventId } },
      { label: 'Editor templat', active: true },
    ];
    if (view.name === 'generate') return [
      { label: 'Beranda', view: { name: 'home' } },
      { label: 'Sertifikat Generator', view: { name: 'sertifikat' } },
      { label: evLabel, active: true },
    ];
    return [{ label: 'Beranda', active: true }];
  })();
```

- [ ] **Step 3: Update the render branches**

Replace:

```tsx
        {isPaktaView && <PaktaAdminRoot />}
        {!isPaktaView && view.name === 'home' && <EventList />}
        {!isPaktaView && view.name === 'editor' && <CertificateEditor key={view.eventId} eventId={view.eventId} />}
        {!isPaktaView && view.name === 'generate' && <GenerateView key={view.eventId} eventId={view.eventId} />}
```

with:

```tsx
        {isPaktaView && <PaktaAdminRoot />}
        {!isPaktaView && view.name === 'home' && <Hub />}
        {!isPaktaView && view.name === 'sertifikat' && <EventList />}
        {!isPaktaView && view.name === 'editor' && <CertificateEditor key={view.eventId} eventId={view.eventId} />}
        {!isPaktaView && view.name === 'generate' && <GenerateView key={view.eventId} eventId={view.eventId} />}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors. (This confirms the `sertifikat` branch is handled everywhere `view.name` is switched on — if a case were missing where `view.eventId` is accessed, this would fail because `sertifikat` has no `eventId`.)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): render Hub on home and move EventList to the sertifikat view"
```

---

### Task 5: Remove the now-redundant "Pakta Integritas" button from `EventList`

**Files:**
- Modify: `src/components/EventList.tsx`

No automated test for this task — see the "File Structure" note above. Verified manually in Task 6.

- [ ] **Step 1: Remove the button**

In `src/components/EventList.tsx`, the `sg-home-actions` block currently ends with:

```tsx
          <button
            className="sg-btn sg-btn-secondary sg-btn-pill"
            onClick={() => navigate({ name: 'pakta-admin' })}
          >
            Pakta Integritas
          </button>
        </div>
      </div>
```

Remove that `<button>...</button>` (keep the two surrounding closing `</div>` tags), so it reads:

```tsx
        </div>
      </div>
```

- [ ] **Step 2: Remove the now-unused `navigate` import if nothing else in the file uses it**

Check remaining usages:

Run: `grep -n "navigate(" src/components/EventList.tsx`
Expected: one remaining call — `navigate({ name: 'editor', eventId: ev.id });` inside `handleSave`. Since `navigate` is still used, **keep the import** (`import { navigate } from './AppRouter';`). No change needed here.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/EventList.tsx
git commit -m "chore(event-list): remove Pakta Integritas button, now handled by the Hub"
```

---

### Task 6: Full test suite, build, and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test`
Expected: all tests pass, including the 4 new files (`appRouter.test.ts`, `Hub.test.tsx`, `AppTopbar.test.tsx`, plus every pre-existing test file unaffected).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: builds successfully (`tsc -b && vite build`), no type errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new lint errors introduced by this change (report honestly if pre-existing warnings remain — do not claim "clean" unless zero warnings).

- [ ] **Step 4: Manual browser verification**

Start the dev server (`npm run dev`) and, in a preview browser, walk through the checklist from the spec (`docs/superpowers/specs/2026-07-02-landing-hub-design.md`, "Verifikasi" section):

1. Open root (`#` empty hash) → Hub renders with 2 cards ("Sertifikat Generator", "Pakta Integritas").
2. Click "Sertifikat Generator" card → lands on the event list (`#sertifikat`), breadcrumb reads `Beranda → Sertifikat Generator`.
3. Click "Pakta Integritas" card → lands on the Pakta admin flow (login screen if not logged in), breadcrumb reads `Beranda → Pakta Integritas`.
4. From inside both modules (including sub-views: editor, generate, pakta-editor, pakta-dashboard), click the breadcrumb "Beranda" — returns to the Hub. Click the topbar logo "S" — also returns to the Hub.
5. Tab to a Hub card with keyboard, press Enter/Space — activates navigation (same as click).
6. Resize the preview to mobile width — Hub cards stack vertically, no overlap; re-check the Pakta admin mobile layout (from the earlier `4f26d0a` fix) still has no overlap.

- [ ] **Step 5: Update the agent handoff doc**

Update `docs/agent-handoff.md` per the project's Finish Protocol (branch, task, files changed, commands run, build/lint/test result, known issues, next step). Do not commit/push unless the user explicitly asks — leave changes local per project policy.

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-07-02-landing-hub-design.md` maps to a task — routing (Task 1), `Hub.tsx` (Task 2), topbar logo (Task 3), `App.tsx` wiring/breadcrumbs (Task 4), `EventList.tsx` button removal (Task 5), verification checklist (Task 6).
- **Type consistency:** `{ name: 'sertifikat' }` is used identically across `AppRouter.tsx` (Task 1), `Hub.tsx`'s `onClick` (Task 2), and `App.tsx`'s breadcrumbs/render branches (Task 4) — no naming drift (e.g. no `'certificates'` vs `'sertifikat'` mismatch).
- **No placeholders:** every step has literal code, exact file paths, and exact commands with expected outcomes.
