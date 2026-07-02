# Slug Custom untuk Link Tanda Tangan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw-UUID public link for Pakta Integritas signing pages (`#pakta/{uuid}`) with an admin-editable human-readable slug (`#pakta/{slug}`), auto-generated from the event name at creation and editable anytime from the dashboard.

**Architecture:** Add a `slug` column to `pakta_events` (Supabase migration, backfilled for existing rows). A new `src/lib/slug.ts` utility provides `slugify()` (server-side auto-generation) and `isValidSlug()` (shared format validation). `api/pakta-admin.ts`'s `create_event` auto-generates a unique slug with collision retry; `update_event` (already generic) gets slug-specific validation and a friendlier conflict error. The public lookup path (`paktaStore.ts` → `PaktaSignPage.tsx`) switches from querying by `id` to querying by `slug`, resolving the real UUID once up front and using it for everything downstream (signer queries, PDF upload). `PaktaDashboard.tsx` gets an inline slug-editing UI in the existing "Link Tanda Tangan" card.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + supabase-js), Vercel serverless functions (`api/*.ts`), Vitest.

---

## Global Constraints (from the spec)

- Slug format: lowercase letters, digits, and hyphens only, 3–60 characters, no leading/trailing hyphen, no consecutive hyphens. Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`.
- One link per event (not per signer) — this plan does not add per-signer links.
- Changing a slug immediately invalidates the old one — no redirect/alias.
- The migration SQL file is written but **not executed by the agent** — it's run manually by the user in the Supabase SQL Editor, per project rules on production database changes.
- Admin-internal navigation (`pakta-editor`, `pakta-dashboard` routes) keeps using the real UUID (`event.id`) — only the public signer-facing link/route switches to slug.

---

## File Structure

- **Create:** `supabase/migrations/0002_pakta_event_slug.sql` — schema migration + backfill (not run by agent).
- **Create:** `src/lib/slug.ts` — `slugify()` and `isValidSlug()`, shared by server (`api/pakta-admin.ts`) and client (`PaktaDashboard.tsx`).
- **Create:** `tests/slug.test.ts` — unit tests for the above.
- **Modify:** `api/pakta-admin.ts` — `create_event` auto-slug + collision retry; `update_event` slug validation + conflict error mapping.
- **Modify:** `tests/paktaAdmin.test.ts` — new tests for the above.
- **Modify:** `src/lib/paktaStore.ts` — rename `getAcaraPakta` → `getAcaraByLink`, query by `slug` instead of `id`.
- **Modify:** `tests/paktaStore.test.ts` — updated to match the rename and new lookup column.
- **Modify:** `src/components/pakta-signer/PaktaSignPage.tsx` — prop renamed `eventId` → `slug`; resolves slug to the real event (and its UUID) before querying signers; `get_pdf_upload_url` call uses the resolved UUID.
- **Modify:** `src/components/pakta-admin/PaktaDashboard.tsx` — `publicUrl` derived from `event.slug`; inline slug-editing UI added to the existing "Link Tanda Tangan" card.
- **Modify:** `src/components/AppRouter.tsx` — one-line clarifying comment (no structural change).
- **Modify:** `src/App.tsx` — `PaktaSignPage` call site passes `slug={view.eventId}` instead of `eventId={view.eventId}`.

`PaktaSignPage.tsx` and `PaktaDashboard.tsx` have no existing automated test coverage (no test harness exists for either — both pull in Supabase-backed contexts, QR code generation, and browser APIs that make a full unit harness disproportionate to this change, consistent with how this codebase already handles these two files). Both are verified via `tsc` type-checking and a manual browser walkthrough in Task 8.

---

### Task 1: Migration SQL (not executed by agent)

**Files:**
- Create: `supabase/migrations/0002_pakta_event_slug.sql`

No automated test — this is a one-time SQL script the user runs manually in the Supabase SQL Editor (same convention as `0001_pakta_init.sql`). Verification is a careful read-through, not execution.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0002_pakta_event_slug.sql`:

```sql
-- ============================================================
-- Pakta Integritas: slug custom untuk link tanda tangan publik
-- Jalankan sekali di Supabase SQL Editor (setelah 0001_pakta_init.sql)
-- ============================================================

-- 1. Tambah kolom slug (nullable dulu, diisi lewat backfill di bawah)
alter table pakta_events add column if not exists slug text;

-- 2. Backfill: buat slug dari nama untuk semua baris yang sudah ada,
--    tambahkan akhiran -2, -3, dst kalau ada nama yang menghasilkan
--    slug dasar yang sama.
with base as (
  select
    id,
    trim(both '-' from regexp_replace(lower(nama), '[^a-z0-9]+', '-', 'g')) as base_slug,
    created_at
  from pakta_events
  where slug is null
),
numbered as (
  select
    id,
    case
      when row_number() over (partition by base_slug order by created_at) = 1
        then coalesce(nullif(base_slug, ''), 'acara')
      else coalesce(nullif(base_slug, ''), 'acara') || '-' ||
           row_number() over (partition by base_slug order by created_at)::text
    end as new_slug
  from base
)
update pakta_events e
set slug = n.new_slug
from numbered n
where e.id = n.id;

-- 3. Kunci kolom: wajib diisi, unik, dan format terbatas
alter table pakta_events
  alter column slug set not null;

alter table pakta_events
  add constraint pakta_events_slug_unique unique (slug);

alter table pakta_events
  add constraint pakta_events_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60);
```

- [ ] **Step 2: Read-through check (no execution)**

Re-read the file and confirm: (a) step 1 adds the column nullable so it doesn't fail on existing rows, (b) step 2's `row_number() ... = 1` case omits the numeric suffix for the first occurrence of each name (so a genuinely unique event name gets a clean slug, not `-1`), (c) step 3 only tightens constraints after every row already has a value, so it can't fail on pre-existing NULLs.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_pakta_event_slug.sql
git commit -m "feat(pakta): add slug column migration for custom signing links (not executed — run manually in Supabase SQL Editor)"
```

---

### Task 2: `slugify()` / `isValidSlug()` utility

**Files:**
- Create: `src/lib/slug.ts`
- Test: `tests/slug.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slugify, isValidSlug } from '../src/lib/slug';

describe('slugify', () => {
  it('mengubah spasi jadi tanda hubung dan huruf jadi kecil', () => {
    expect(slugify('Pelatihan Juli 2026')).toBe('pelatihan-juli-2026');
  });

  it('mengganti karakter selain huruf/angka dengan tanda hubung', () => {
    expect(slugify('Rapat & Evaluasi (Q3)!')).toBe('rapat-evaluasi-q3');
  });

  it('menggabungkan tanda hubung berurutan jadi satu', () => {
    expect(slugify('A   B---C')).toBe('a-b-c');
  });

  it('memotong hasil ke maksimum 60 karakter tanpa menyisakan tanda hubung di akhir', () => {
    const longName = 'kata '.repeat(20);
    const result = slugify(longName);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith('-')).toBe(false);
  });

  it('mengembalikan string kosong bila input hanya simbol', () => {
    expect(slugify('!!!###')).toBe('');
  });
});

describe('isValidSlug', () => {
  it('menerima slug yang valid', () => {
    expect(isValidSlug('pelatihan-juli-2026')).toBe(true);
  });

  it('menolak slug dengan huruf besar', () => {
    expect(isValidSlug('Pelatihan-Juli')).toBe(false);
  });

  it('menolak slug lebih pendek dari 3 karakter', () => {
    expect(isValidSlug('ab')).toBe(false);
  });

  it('menolak slug dengan tanda hubung di awal/akhir', () => {
    expect(isValidSlug('-pelatihan')).toBe(false);
    expect(isValidSlug('pelatihan-')).toBe(false);
  });

  it('menolak slug dengan karakter selain huruf/angka/tanda hubung', () => {
    expect(isValidSlug('pelatihan_juli')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slug.test.ts`
Expected: FAIL — cannot find module `../src/lib/slug`.

- [ ] **Step 3: Implement `src/lib/slug.ts`**

```ts
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 60;
const MIN_SLUG_LENGTH = 3;

/** Ubah teks bebas jadi slug URL: huruf kecil, angka, dan tanda hubung saja. */
export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

/** Validasi format slug: huruf kecil/angka/tanda hubung, 3-60 karakter. */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= MIN_SLUG_LENGTH &&
    slug.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(slug)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/slug.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/slug.test.ts
git commit -m "feat(pakta): add slugify/isValidSlug utility for custom signing links"
```

---

### Task 3: `api/pakta-admin.ts` — auto-slug on create, validation + friendly error on update

**Files:**
- Modify: `api/pakta-admin.ts`
- Test: `tests/paktaAdmin.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/paktaAdmin.test.ts`, add these tests inside the existing `describe('pakta-admin handler', ...)` block (place them after the existing `'create_event menyimpan acara dan mengembalikan id'` test):

```ts
  // WHY: slug harus otomatis dibuat dari nama acara supaya admin tidak perlu isi manual saat membuat kegiatan.
  it('create_event membuat slug otomatis dari nama', async () => {
    const newEvent = { id: 'ev-new', nama: 'Pakta Baru', slug: 'pakta-baru', status: 'aktif' };
    const selectFn = vi.fn().mockResolvedValue({ data: [newEvent], error: null });
    const insertMock = vi.fn().mockReturnValue({ select: selectFn });
    fromAdminMock.mockReturnValue({ insert: insertMock });

    const res = mockRes();
    await handler(mockReq({
      action: 'create_event',
      nama: 'Pakta Baru',
      tanggal: '2026-07-01',
      bg_width: 800,
      bg_height: 600,
      fields: [],
    }), res);

    expect(res.statusCode).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0].slug).toBe('pakta-baru');
  });

  // WHY: dua acara dengan nama yang menghasilkan slug sama harus otomatis dapat akhiran -2, -3, dst — bukan gagal.
  it('create_event menambah akhiran -2 kalau slug dasar sudah dipakai', async () => {
    const selectFn = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key' } })
      .mockResolvedValueOnce({ data: [{ id: 'ev-new', slug: 'pakta-baru-2' }], error: null });
    const insertMock = vi.fn().mockReturnValue({ select: selectFn });
    fromAdminMock.mockReturnValue({ insert: insertMock });

    const res = mockRes();
    await handler(mockReq({
      action: 'create_event',
      nama: 'Pakta Baru',
      tanggal: '2026-07-01',
      bg_width: 800,
      bg_height: 600,
      fields: [],
    }), res);

    expect(res.statusCode).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0][0].slug).toBe('pakta-baru');
    expect(insertMock.mock.calls[1][0].slug).toBe('pakta-baru-2');
  });

  // WHY: kegagalan lain (bukan tabrakan slug) harus langsung dilaporkan, bukan diulang sia-sia.
  it('create_event langsung gagal kalau error bukan tabrakan slug', async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: null, error: { code: '23502', message: 'not null violation' } });
    const insertMock = vi.fn().mockReturnValue({ select: selectFn });
    fromAdminMock.mockReturnValue({ insert: insertMock });

    const res = mockRes();
    await handler(mockReq({
      action: 'create_event',
      nama: 'Pakta Baru',
      tanggal: '2026-07-01',
      bg_width: 800,
      bg_height: 600,
      fields: [],
    }), res);

    expect(res.statusCode).toBe(500);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  // WHY: update_event harus menerjemahkan error tabrakan slug Postgres jadi pesan yang dimengerti admin.
  it('update_event mengembalikan pesan jelas kalau slug sudah dipakai', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    fromAdminMock.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqMock }) });

    const res = mockRes();
    await handler(mockReq({ action: 'update_event', id: 'ev1', slug: 'sudah-dipakai' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Slug ini sudah dipakai kegiatan lain');
  });

  // WHY: format slug tidak valid harus ditolak sebelum menyentuh database.
  it('update_event menolak slug dengan format tidak valid', async () => {
    fromAdminMock.mockReturnValue({});
    const res = mockRes();
    await handler(mockReq({ action: 'update_event', id: 'ev1', slug: 'Slug Tidak Valid!' }), res);
    expect(res.statusCode).toBe(400);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/paktaAdmin.test.ts`
Expected: FAIL — `create_event` doesn't set `slug` yet; `update_event` doesn't map `23505` or validate format yet.

- [ ] **Step 3: Implement the changes in `api/pakta-admin.ts`**

Add the import at the top (after the existing imports):

```ts
import { slugify, isValidSlug } from '../src/lib/slug.js';
```

Add a constant after `verifyPassword`'s closing brace (before `export default async function handler`):

```ts
const MAX_SLUG_ATTEMPTS = 30;
```

Replace the `case 'create_event':` block:

```ts
    case 'create_event': {
      const { nama, tanggal, template_path, bg_width, bg_height, fields } = body as {
        nama: string; tanggal: string; template_path?: string;
        bg_width: number; bg_height: number; fields: unknown[];
      };
      if (!nama || !tanggal) {
        return res.status(400).json({ error: 'nama dan tanggal wajib diisi' });
      }
      const base = slugify(nama) || 'acara';
      let candidate = base;
      let data: { id: string }[] | null = null;
      let error: { code?: string; message: string } | null = null;
      for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
        const result = await sb
          .from('pakta_events')
          .insert({ nama, tanggal, template_path: template_path ?? null, bg_width, bg_height, fields, slug: candidate })
          .select();
        data = result.data;
        error = result.error;
        if (!error) break;
        if (error.code !== '23505') {
          return res.status(500).json({ error: error.message });
        }
        candidate = `${base}-${attempt + 1}`;
      }
      if (error) return res.status(500).json({ error: 'Gagal membuat slug unik untuk kegiatan ini setelah beberapa percobaan' });
      return res.status(200).json({ event: data?.[0] ?? null });
    }
```

Replace the `case 'update_event':` block:

```ts
    case 'update_event': {
      const { id, action: _action, ...patch } = body as { id: string; action: string; [k: string]: unknown };
      if (!id) return res.status(400).json({ error: 'id acara wajib diisi' });
      if (typeof patch.slug === 'string' && !isValidSlug(patch.slug)) {
        return res.status(400).json({ error: 'Slug harus huruf kecil, angka, dan tanda hubung saja (3-60 karakter)' });
      }
      const { error } = await sb.from('pakta_events').update(patch).eq('id', id);
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Slug ini sudah dipakai kegiatan lain' });
        }
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ ok: true });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/paktaAdmin.test.ts`
Expected: PASS (all tests, including the 5 new ones — 19 total)

- [ ] **Step 5: Commit**

```bash
git add api/pakta-admin.ts tests/paktaAdmin.test.ts
git commit -m "feat(pakta): auto-generate unique slug on create, validate + map conflicts on update"
```

---

### Task 4: `paktaStore.ts` — lookup by slug instead of id

**Files:**
- Modify: `src/lib/paktaStore.ts`
- Modify: `tests/paktaStore.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/paktaStore.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mock vars inside vi.hoisted() to avoid TDZ errors with vi.mock hoisting
const { singleMock, selectMock, updateMock, fromMock, eqEventsMock } = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn();
  const updateMock = vi.fn();
  const eqEventsMock = vi.fn().mockReturnValue({ single: singleMock });
  const fromMock = vi.fn((table: string) => {
    if (table === 'pakta_events') {
      return {
        select: vi.fn().mockReturnValue({ eq: eqEventsMock }),
      };
    }
    if (table === 'pakta_signers') {
      return { select: selectMock, update: updateMock };
    }
    return {};
  });
  return { singleMock, selectMock, updateMock, fromMock, eqEventsMock };
});

vi.mock('../src/lib/supabaseClient', () => ({
  getSupabaseClient: vi.fn().mockReturnValue({ from: fromMock }),
}));

import { getAcaraByLink, listSigners, updateSignerDone } from '../src/lib/paktaStore';

describe('getAcaraByLink', () => {
  beforeEach(() => {
    singleMock.mockReset();
    fromMock.mockClear();
    eqEventsMock.mockClear();
  });

  it('mengembalikan PaktaTemplate bila acara ditemukan lewat slug dan aktif', async () => {
    singleMock.mockResolvedValue({
      data: {
        id: 'ev1',
        nama: 'Pakta 2026',
        tanggal: '2026-07-01',
        template_path: 'pakta-templates/ev1/bg.png',
        bg_width: 800,
        bg_height: 600,
        fields: [{ id: 'f1', tipe: 'nama', x: 100, y: 200, lebar: 600,
          fontFamily: 'Playfair Display', fontWeight: 'Regular',
          ukuran: 28, warna: '#000000', perataan: 'center', formatter: 'none' }],
        status: 'aktif',
      },
      error: null,
    });

    const result = await getAcaraByLink('pelatihan-2026');
    // WHY: fungsi harus mengembalikan PaktaTemplate (background diisi setelah template_path diketahui)
    expect(result).not.toBeNull();
    expect(result!.eventId).toBe('ev1');
    expect(result!.bgWidth).toBe(800);
    expect(result!.bgHeight).toBe(600);
    expect(result!.fields).toHaveLength(1);
    // WHY: lookup harus lewat kolom slug, bukan lagi id — ini inti dari perubahan link custom.
    expect(eqEventsMock).toHaveBeenCalledWith('slug', 'pelatihan-2026');
  });

  it('mengembalikan null bila slug tidak ditemukan (error Supabase)', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const result = await getAcaraByLink('slug-tidak-ada');
    // WHY: halaman publik harus handle acara tidak ada dengan graceful, termasuk slug lama/salah
    expect(result).toBeNull();
  });

  it('mengembalikan null bila acara berstatus ditutup', async () => {
    singleMock.mockResolvedValue({
      data: { id: 'ev2', status: 'ditutup', bg_width: 800, bg_height: 600, fields: [] },
      error: null,
    });
    const result = await getAcaraByLink('pelatihan-2026');
    // WHY: pegawai tidak boleh tanda tangan setelah acara ditutup
    expect(result).toBeNull();
  });
});

describe('listSigners', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it('mengembalikan daftar signer dengan status', async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { id: 's1', nama: 'Budi', nip: '123', jabatan: 'Staf', status: 'belum', signed_at: null, pdf_path: null },
        { id: 's2', nama: 'Ani',  nip: '456', jabatan: 'Kabag', status: 'sudah', signed_at: '2026-07-01T10:00:00Z', pdf_path: 'pakta-documents/ev1/s2.pdf' },
      ],
      error: null,
    });
    selectMock.mockReturnValue({ eq: eqMock });

    const signers = await listSigners('ev1');
    // WHY: daftar nama harus tampil dengan status untuk UI pilih-nama dan dashboard admin
    expect(signers).toHaveLength(2);
    expect(signers[0].status).toBe('belum');
    expect(signers[1].status).toBe('sudah');
  });

  it('mengembalikan array kosong bila Supabase error', async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'error' } });
    selectMock.mockReturnValue({ eq: eqMock });
    const signers = await listSigners('ev1');
    // WHY: error Supabase tidak boleh crash halaman publik
    expect(signers).toEqual([]);
  });
});

describe('updateSignerDone', () => {
  beforeEach(() => {
    updateMock.mockReset();
  });

  it('mengirim status sudah + pdf_path + signed_at ke Supabase', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });

    await updateSignerDone('s1', 'pakta-documents/ev1/s1.pdf');

    // WHY: status harus 'sudah' agar RLS memblokir tanda tangan ulang
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sudah',
        pdf_path: 'pakta-documents/ev1/s1.pdf',
      }),
    );
    expect(eqMock).toHaveBeenCalledWith('id', 's1');
  });

  it('melempar error bila Supabase gagal menyimpan', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'RLS rejected' } });
    updateMock.mockReturnValue({ eq: eqMock });

    // WHY: gagal simpan harus diketahui agar UI bisa tampilkan pesan retry
    await expect(updateSignerDone('s1', 'path/s1.pdf')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/paktaStore.test.ts`
Expected: FAIL — `getAcaraByLink` is not exported from `../src/lib/paktaStore` yet (it's still named `getAcaraPakta` and queries by `id`).

- [ ] **Step 3: Implement the change in `src/lib/paktaStore.ts`**

Replace the `getAcaraPakta` function (lines 16-44) with:

```ts
/**
 * Ambil data acara pakta untuk halaman tanda tangan publik lewat slug link
 * custom (bukan UUID). Mengembalikan null bila slug tidak ditemukan atau
 * acara sudah ditutup.
 * Catatan: background belum diisi di sini (diunduh terpisah di Plan 4).
 */
export async function getAcaraByLink(slug: string): Promise<
  (PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }) | null
> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('pakta_events')
    .select('id, nama, tanggal, template_path, bg_width, bg_height, fields, status')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  if (data.status === 'ditutup') return null;

  return {
    eventId: data.id,
    nama: data.nama,
    tanggal: data.tanggal,
    templatePath: data.template_path ?? '',
    background: '',    // diisi Plan 4 setelah unduh dari Storage
    bgWidth: data.bg_width,
    bgHeight: data.bg_height,
    fields: data.fields ?? [],
  };
}
```

`listSigners` and `updateSignerDone` are unchanged — leave them exactly as they are.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/paktaStore.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/paktaStore.ts tests/paktaStore.test.ts
git commit -m "feat(pakta): look up public event by slug instead of UUID"
```

---

### Task 5: `PaktaSignPage.tsx` — consume slug, resolve real UUID for signer queries

**Files:**
- Modify: `src/components/pakta-signer/PaktaSignPage.tsx`

No automated test for this task (see File Structure note above). Verified by `tsc` type-check (Step 4) and the manual browser walkthrough in Task 8.

- [ ] **Step 1: Update the import**

In `src/components/pakta-signer/PaktaSignPage.tsx`, replace:

```tsx
import { getAcaraPakta, listSigners, updateSignerDone, type SignerRow } from '../../lib/paktaStore';
```

with:

```tsx
import { getAcaraByLink, listSigners, updateSignerDone, type SignerRow } from '../../lib/paktaStore';
```

- [ ] **Step 2: Rename the prop**

Replace:

```tsx
export function PaktaSignPage({ eventId }: { eventId: string }) {
```

with:

```tsx
export function PaktaSignPage({ slug }: { slug: string }) {
```

- [ ] **Step 3: Resolve slug to the real event before querying signers**

Replace the `useEffect` block:

```tsx
  useEffect(() => {
    let cancelled = false;
    setState({ step: 'loading' });
    (async () => {
      const [template, signers] = await Promise.all([
        getAcaraPakta(eventId),
        listSigners(eventId),
      ]);
      if (cancelled) return;
      if (!template) {
        setState({ step: 'notFound' });
        return;
      }
      setState({ step: 'pickName', template, signers });
    })();
    return () => { cancelled = true; };
  }, [eventId, loadKey]);
```

with:

```tsx
  useEffect(() => {
    let cancelled = false;
    setState({ step: 'loading' });
    (async () => {
      const template = await getAcaraByLink(slug);
      if (cancelled) return;
      if (!template) {
        setState({ step: 'notFound' });
        return;
      }
      const signers = await listSigners(template.eventId);
      if (cancelled) return;
      setState({ step: 'pickName', template, signers });
    })();
    return () => { cancelled = true; };
  }, [slug, loadKey]);
```

- [ ] **Step 4: Use the resolved UUID for the PDF upload request**

Inside `handleSubmit`, replace:

```tsx
        body: JSON.stringify({ action: 'get_pdf_upload_url', signerId: signer.id, eventId }),
```

with:

```tsx
        body: JSON.stringify({ action: 'get_pdf_upload_url', signerId: signer.id, eventId: template.eventId }),
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors related to `PaktaSignPage.tsx`. (Note: `App.tsx` will still fail here because it hasn't been updated to pass `slug` yet — that's Task 7. If you see an error pointing at `App.tsx`'s `<PaktaSignPage ... eventId={view.eventId} />` call, that's expected at this point in the plan; don't fix it here.)

- [ ] **Step 6: Commit**

```bash
git add src/components/pakta-signer/PaktaSignPage.tsx
git commit -m "feat(pakta): resolve public signer page by slug, use real UUID downstream"
```

---

### Task 6: `PaktaDashboard.tsx` — slug-based public URL + inline edit UI

**Files:**
- Modify: `src/components/pakta-admin/PaktaDashboard.tsx`

No automated test for this task (see File Structure note above). Verified by `tsc` type-check (Step 6) and the manual browser walkthrough in Task 8.

- [ ] **Step 1: Add the `isValidSlug` import**

Replace:

```tsx
import { buildZip, downloadBlob } from '../../lib/download';
```

with:

```tsx
import { buildZip, downloadBlob } from '../../lib/download';
import { isValidSlug } from '../../lib/slug';
```

- [ ] **Step 2: Add `slug` to `EventDetail`, add a `buildPublicUrl` helper, move URL construction into `load()`, add new state**

Replace:

```tsx
interface EventDetail {
  id: string;
  nama: string;
  tanggal: string;
  status: 'aktif' | 'ditutup';
  pakta_signers: Signer[];
}

export function PaktaDashboard({ eventId }: { eventId: string }) {
  const { callAdmin } = usePaktaAdmin();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [bulkPhase, setBulkPhase] = useState<BulkDownloadPhase>('idle');
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCurrentName, setBulkCurrentName] = useState('');

  const publicUrl = `${window.location.origin}/#pakta/${eventId}`;

  async function load() {
    setLoading(true);
    try {
      const { event: ev } = await callAdmin<{ event: EventDetail }>('get_event', { id: eventId });
      setEvent(ev);
      const qr = await QRCode.toDataURL(publicUrl, { width: 200, margin: 1 });
      setQrDataUrl(qr);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps
```

with:

```tsx
interface EventDetail {
  id: string;
  nama: string;
  tanggal: string;
  status: 'aktif' | 'ditutup';
  slug: string;
  pakta_signers: Signer[];
}

function buildPublicUrl(slug: string): string {
  return `${window.location.origin}/#pakta/${slug}`;
}

export function PaktaDashboard({ eventId }: { eventId: string }) {
  const { callAdmin } = usePaktaAdmin();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [bulkPhase, setBulkPhase] = useState<BulkDownloadPhase>('idle');
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCurrentName, setBulkCurrentName] = useState('');
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { event: ev } = await callAdmin<{ event: EventDetail }>('get_event', { id: eventId });
      setEvent(ev);
      const qr = await QRCode.toDataURL(buildPublicUrl(ev.slug), { width: 200, margin: 1 });
      setQrDataUrl(qr);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Replace `copyLink` and add slug-editing functions**

Replace:

```tsx
  function copyLink() {
    navigator.clipboard.writeText(publicUrl).catch(() => {});
  }
```

with:

```tsx
  function copyLink() {
    if (!event) return;
    navigator.clipboard.writeText(buildPublicUrl(event.slug)).catch(() => {});
  }

  function startEditSlug() {
    if (!event) return;
    setSlugInput(event.slug);
    setSlugError('');
    setEditingSlug(true);
  }

  async function saveSlug() {
    if (!event) return;
    const trimmed = slugInput.trim();
    if (!isValidSlug(trimmed)) {
      setSlugError('Slug harus huruf kecil, angka, dan tanda hubung saja (3-60 karakter)');
      return;
    }
    setSavingSlug(true);
    setSlugError('');
    try {
      await callAdmin('update_event', { id: eventId, slug: trimmed });
      setEvent({ ...event, slug: trimmed });
      const qr = await QRCode.toDataURL(buildPublicUrl(trimmed), { width: 200, margin: 1 });
      setQrDataUrl(qr);
      setEditingSlug(false);
    } catch (err) {
      setSlugError((err as Error).message);
    } finally {
      setSavingSlug(false);
    }
  }
```

- [ ] **Step 4: Compute `publicUrl` after the loading guard**

Replace:

```tsx
  if (loading || !event) return <div style={{ padding: 40 }}><p className="apple-caption">Memuat…</p></div>;

  const signers = event.pakta_signers ?? [];
```

with:

```tsx
  if (loading || !event) return <div style={{ padding: 40 }}><p className="apple-caption">Memuat…</p></div>;

  const publicUrl = buildPublicUrl(event.slug);
  const signers = event.pakta_signers ?? [];
```

- [ ] **Step 5: Replace the "Link Tanda Tangan" card JSX**

Replace:

```tsx
        <div className="apple-card">
          <div className="apple-card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Link Tanda Tangan</div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code link tanda tangan" style={{ width: 180, height: 180 }} />
            )}
            <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 8, wordBreak: 'break-all' }}>
              {publicUrl}
            </div>
            <button
              className="sg-btn sg-btn-outline"
              style={{ marginTop: 10, fontSize: 12, width: '100%' }}
              onClick={copyLink}
            >
              Salin Link
            </button>
          </div>
        </div>
```

with:

```tsx
        <div className="apple-card">
          <div className="apple-card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>Link Tanda Tangan</div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code link tanda tangan" style={{ width: 180, height: 180 }} />
            )}
            {editingSlug ? (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  className="apple-input"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  style={{ width: '100%', fontSize: 12 }}
                  disabled={savingSlug}
                />
                {slugError && (
                  <p className="apple-error" style={{ fontSize: 11, marginTop: 6 }}>{slugError}</p>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    className="sg-btn sg-btn-primary"
                    style={{ flex: 1, fontSize: 12 }}
                    disabled={savingSlug}
                    onClick={saveSlug}
                  >
                    {savingSlug ? 'Menyimpan…' : 'Simpan'}
                  </button>
                  <button
                    className="sg-btn sg-btn-outline"
                    style={{ flex: 1, fontSize: 12 }}
                    disabled={savingSlug}
                    onClick={() => setEditingSlug(false)}
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 8, wordBreak: 'break-all' }}>
                  {publicUrl}
                </div>
                <button
                  className="sg-btn sg-btn-outline"
                  style={{ marginTop: 10, fontSize: 12, width: '100%' }}
                  onClick={startEditSlug}
                >
                  Ubah
                </button>
                <button
                  className="sg-btn sg-btn-outline"
                  style={{ marginTop: 6, fontSize: 12, width: '100%' }}
                  onClick={copyLink}
                >
                  Salin Link
                </button>
              </>
            )}
          </div>
        </div>
```

- [ ] **Step 6: Type-check**

Run: `npx tsc -b`
Expected: no errors related to `PaktaDashboard.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/components/pakta-admin/PaktaDashboard.tsx
git commit -m "feat(pakta): show slug-based public link, add inline slug editing"
```

---

### Task 7: Wire `slug` prop through `App.tsx`, clarify `AppRouter.tsx`

**Files:**
- Modify: `src/components/AppRouter.tsx`
- Modify: `src/App.tsx`

No automated test for this task (one-line rename + one-line comment). Verified by `tsc` type-check.

- [ ] **Step 1: Add a clarifying comment in `AppRouter.tsx`**

In `src/components/AppRouter.tsx`, replace:

```ts
  | { name: 'pakta-signer'; eventId: string };
```

with:

```ts
  | { name: 'pakta-signer'; eventId: string };  // eventId di sini adalah slug publik (lihat src/lib/slug.ts), bukan UUID
```

- [ ] **Step 2: Update the `PaktaSignPage` call site in `App.tsx`**

In `src/App.tsx`, replace:

```tsx
  if (view.name === 'pakta-signer') {
    return <PaktaSignPage key={view.eventId} eventId={view.eventId} />;
  }
```

with:

```tsx
  if (view.name === 'pakta-signer') {
    return <PaktaSignPage key={view.eventId} slug={view.eventId} />;
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors anywhere (this resolves the `App.tsx` error that was expected-but-not-fixed at the end of Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/components/AppRouter.tsx src/App.tsx
git commit -m "feat(pakta): wire slug prop from router into PaktaSignPage"
```

---

### Task 8: Full suite, build, and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test`
Expected: all tests pass, including the new/updated files from Tasks 2-4.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: builds successfully, no type errors. (Note: `api/*.ts` is not covered by this project's `tsc -b` scope — it's outside the `tsconfig.json` `include` list, same as before this change — so `slugify`/`isValidSlug` usage in `api/pakta-admin.ts` is verified by the Vitest suite in Task 3, not by this build step.)

- [ ] **Step 3: Manual browser verification**

Since there's no real Supabase admin session available in this environment, verify with mocked `window.fetch`/`callAdmin` responses in the preview browser (same approach used in prior sessions for this same dashboard — see `docs/agent-handoff.md` history):

1. Load a mocked `PaktaDashboard` for an event with `slug: 'pelatihan-juli-2026'` — confirm the "Link Tanda Tangan" card shows `#pakta/pelatihan-juli-2026`, not a UUID.
2. Click "Ubah" — confirm the input appears pre-filled with the current slug, "Simpan"/"Batal" buttons appear.
3. Type an invalid slug (e.g. `"Ada Spasi"`) and click "Simpan" — confirm the inline error message appears and no request is sent (client-side `isValidSlug` check blocks it before calling `update_event`).
4. Type a valid new slug and confirm the mocked `update_event` call fires with `{ id, slug }`, and after success the card shows the new link/QR and exits edit mode.
5. Load a mocked `PaktaSignPage` with a `slug` prop — confirm it calls `getAcaraByLink` (not `getAcaraPakta`) and, once resolved, calls `listSigners` with the resolved UUID from the mocked response, not the slug string itself.

- [ ] **Step 4: Update the agent handoff doc**

Update `docs/agent-handoff.md` per the project's Finish Protocol (branch, task, files changed, commands run, build/lint/test result, known issues — including the reminder that `supabase/migrations/0002_pakta_event_slug.sql` still needs to be run manually by the user in the Supabase SQL Editor before this feature works in production — and next step). Do not commit/push unless the user explicitly asks — leave changes local per project policy.

---

## Self-Review Notes

- **Spec coverage:** migration + backfill (Task 1), slug format/generation utility (Task 2), server-side auto-generate + collision retry + friendly conflict error (Task 3), slug-based public lookup (Task 4), signer page consuming slug and using the resolved UUID downstream (Task 5), inline dashboard editing UI (Task 6), router/App wiring (Task 7), and the spec's manual-verification checklist (Task 8) are all covered.
- **Type consistency:** `getAcaraByLink(slug: string)` is the same name and signature everywhere it's referenced — `paktaStore.ts` (Task 4), `PaktaSignPage.tsx` (Task 5), and the test file (Task 4). `isValidSlug` and `slugify` are defined once in `src/lib/slug.ts` (Task 2) and imported with matching names in `api/pakta-admin.ts` (Task 3) and `PaktaDashboard.tsx` (Task 6) — no drift.
- **Ordering dependency called out explicitly:** Task 5 leaves a known, expected `tsc` error in `App.tsx` until Task 7 fixes it — this is flagged inline in Task 5's Step 5 so whoever executes the plan doesn't mistake it for a regression to fix out of order.
- **No placeholders:** every step has literal code, exact file paths, and exact commands with expected outcomes.
