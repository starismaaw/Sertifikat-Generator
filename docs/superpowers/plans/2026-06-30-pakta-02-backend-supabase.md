# Pakta Integritas — Rencana 2: Backend Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyediakan backend Supabase (tabel, RLS, storage) serta lapisan data TypeScript — jalur publik (anon key) dan jalur admin (sandi + service-role via Vercel `/api`) — sehingga Rencana 3 (UI Admin) dan Rencana 4 (halaman publik) dapat mengakses data tanpa menyentuh Supabase secara langsung.

**Architecture:** Dua jalur terpisah. Jalur publik: `supabaseClient.ts` (anon key, di browser) + `paktaStore.ts` fungsi publik. Jalur admin: `api/pakta-admin.ts` (Vercel serverless, verifikasi sandi lewat `crypto.timingSafeEqual`, akses penuh via service-role key yang hanya ada di server). Supabase RLS menjadi penjaga kedua di level database.

**Tech Stack:** `@supabase/supabase-js`, Node `crypto` (bawaan, tanpa dep baru), Vercel serverless (`@vercel/node` sudah ada). Semua tes dengan vitest + `vi.mock`.

**Bagian spec yang dicakup:** §3.1, §3.2, §4 (model data + RLS), §5.2 `supabaseClient.ts` + `paktaStore.ts` + `api/pakta-admin.ts`, §6 (error handling admin + publik).

**Catatan ruang lingkup:** Rencana ini TIDAK mencakup UI (Plan 3), halaman publik /ttd (Plan 4), atau upload PDF bertanda tangan (dilakukan di Plan 4). Storage bucket dibuat tapi upload dari browser dilakukan Plan 4.

---

## Struktur File

| File | Tanggung jawab | Aksi |
|---|---|---|
| `supabase/migrations/0001_pakta_init.sql` | DDL tabel + RLS + bucket | Create |
| `src/lib/supabaseClient.ts` | Supabase anon-key client (browser) | Create |
| `src/lib/paktaStore.ts` | Fungsi data publik (get event, list signers, update signer) | Create |
| `api/pakta-admin.ts` | Vercel serverless: verifikasi sandi + operasi admin service-role | Create |
| `tests/paktaStore.test.ts` | Unit test fungsi publik (Supabase di-mock) | Create |
| `tests/paktaAdmin.test.ts` | Unit test endpoint admin (Supabase di-mock) | Create |

---

## Global Constraints

- `SUPABASE_SERVICE_ROLE_KEY` **hanya** ada di `api/pakta-admin.ts` (server) — TIDAK pernah di `src/`
- `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` boleh ada di browser (`src/`)
- Verifikasi sandi memakai `crypto.timingSafeEqual` (constant-time) dengan env var `PAKTA_ADMIN_PASSWORD`
- Sandi dibandingkan sebagai plaintext di env (tidak di-hash) — sesuai keputusan desain A2
- Semua pesan error dalam **Bahasa Indonesia**
- Tidak ada npm dependency baru kecuali `@supabase/supabase-js`
- Branch `claude/wonderful-solomon-6652df` — jangan pindah branch

---

## Task 1: Tambah dependency + env var template

**Files:**
- Modify: `package.json`
- Create: `.env.example` (jangan `.env` — tidak boleh di-commit)

- [ ] **Step 1: Install `@supabase/supabase-js`**

```bash
cd "/Users/starencik/Library/CloudStorage/OneDrive-KementerianPKP/Balai P3KP Jawa III/00. ME/CLAUDE PROJECT/Sertifikat Generator/wonderful-solomon-6652df"
npm install @supabase/supabase-js
```

Expected: `package.json` dan `package-lock.json` terupdate. Tidak ada error.

- [ ] **Step 2: Buat `.env.example`**

```bash
cat > .env.example << 'EOF'
# Supabase — Pakta Integritas
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Admin Pakta — satu sandi bersama (2 operator)
PAKTA_ADMIN_PASSWORD=<sandi-admin>

# Email (sudah ada)
RESEND_API_KEY=<resend-api-key>
SENDER_EMAIL=noreply@instansi.web.id
INTERNAL_API_TOKEN=<opsional>
EOF
```

- [ ] **Step 3: Verifikasi `.env.example` tidak ter-track sebagai secret**

Run: `cat .gitignore | grep env`
Expected: `.env` dan `.env.*.local` ada di gitignore. `.env.example` BOLEH di-commit (tidak mengandung nilai nyata).

- [ ] **Step 4: Jalankan tes regresi**

Run: `npm test`
Expected: 43/43 PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(pakta): tambah @supabase/supabase-js + env.example"
```

---

## Task 2: Skema SQL + RLS (migration file)

File ini dijalankan sekali di Supabase SQL Editor — bukan dieksekusi oleh kode aplikasi.

**Files:**
- Create: `supabase/migrations/0001_pakta_init.sql`

- [ ] **Step 1: Buat direktori dan file migration**

```bash
mkdir -p supabase/migrations
```

Buat file `supabase/migrations/0001_pakta_init.sql` dengan isi berikut **persis**:

```sql
-- ============================================================
-- Pakta Integritas: tabel, RLS, storage
-- Jalankan sekali di Supabase SQL Editor
-- ============================================================

-- 1. Tabel acara pakta (dibuat admin)
create table if not exists pakta_events (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  tanggal     date not null,
  template_path text,          -- path gambar template di storage
  bg_width    integer not null default 0,
  bg_height   integer not null default 0,
  fields      jsonb not null default '[]'::jsonb,
  status      text not null default 'aktif'
                check (status in ('aktif', 'ditutup')),
  created_at  timestamptz not null default now()
);

-- 2. Tabel penandatangan (satu baris per pegawai per acara)
create table if not exists pakta_signers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references pakta_events(id) on delete cascade,
  nama        text not null,
  nip         text not null default '',
  jabatan     text not null default '',
  data        jsonb not null default '{}'::jsonb,
  status      text not null default 'belum'
                check (status in ('belum', 'sudah')),
  signed_at   timestamptz,
  pdf_path    text,            -- path PDF bertanda tangan di storage
  created_at  timestamptz not null default now()
);

create index if not exists pakta_signers_event_id_idx
  on pakta_signers(event_id);

-- 3. RLS
alter table pakta_events  enable row level security;
alter table pakta_signers enable row level security;

-- anon: boleh baca acara (untuk render halaman /ttd)
create policy "anon read pakta_events"
  on pakta_events for select
  to anon
  using (true);

-- anon: boleh baca daftar signer (untuk pilih nama)
create policy "anon read pakta_signers"
  on pakta_signers for select
  to anon
  using (true);

-- anon: boleh update signer HANYA saat status='belum' (anti-dobel ttd)
create policy "anon update signer sekali"
  on pakta_signers for update
  to anon
  using (status = 'belum')
  with check (status = 'sudah');

-- anon: boleh insert PDF ke bucket pakta-documents
-- (policy storage dibuat di bawah)

-- 4. Storage buckets
insert into storage.buckets (id, name, public)
  values ('pakta-templates', 'pakta-templates', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('pakta-documents', 'pakta-documents', false)
  on conflict (id) do nothing;

-- anon boleh insert ke pakta-documents (upload PDF bertanda tangan)
create policy "anon upload pakta-documents"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'pakta-documents');
```

- [ ] **Step 2: Verifikasi file terbuat**

Run: `wc -l supabase/migrations/0001_pakta_init.sql`
Expected: sekitar 70 baris.

> **Catatan implementer:** File ini TIDAK dieksekusi oleh tes atau kode. Ia dokumentasi DDL yang dijalankan manual di Supabase. Tidak perlu tes untuk task ini.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_pakta_init.sql
git commit -m "chore(pakta): skema SQL tabel pakta_events/signers + RLS + bucket"
```

---

## Task 3: `supabaseClient.ts` — anon key client

**Files:**
- Create: `src/lib/supabaseClient.ts`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/supabaseClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js agar tidak perlu koneksi nyata
const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn().mockReturnValue({ from: vi.fn() }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import { getSupabaseClient } from '../src/lib/supabaseClient';

describe('getSupabaseClient', () => {
  beforeEach(() => {
    createClientMock.mockClear();
    // Reset module state antara tes (singleton cache)
    vi.resetModules();
  });

  it('melempar error bila VITE_SUPABASE_URL tidak di-set', async () => {
    const orig = import.meta.env;
    // @ts-ignore
    import.meta.env = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'key' };
    await expect(async () => {
      const { getSupabaseClient: fresh } = await import('../src/lib/supabaseClient');
      fresh();
    }).rejects.toThrow('VITE_SUPABASE_URL');
    // @ts-ignore
    import.meta.env = orig;
  });

  it('mengembalikan client Supabase bila env terkonfigurasi', () => {
    // @ts-ignore
    import.meta.env = {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-test',
    };
    const client = getSupabaseClient();
    expect(client).toBeDefined();
    expect(createClientMock).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'anon-key-test',
    );
  });
});
```

> **Catatan:** Tes singleton dengan `vi.resetModules` + dynamic import bisa flaky di vitest karena modul di-cache. Jika tes env-check sulit di-isolate, sederhanakan: hanya test bahwa `getSupabaseClient()` memanggil `createClient` dengan URL dan key yang benar (tanpa reset modules). Lihat Step 3 di bawah untuk implementasi yang membuat tes mudah.

- [ ] **Step 2: Jalankan tes — pastikan gagal**

Run: `npm test -- supabaseClient`
Expected: FAIL — `getSupabaseClient` tidak ada.

- [ ] **Step 3: Implementasi `src/lib/supabaseClient.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/** Kembalikan Supabase client (anon key). Singleton per session browser. */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url) throw new Error('VITE_SUPABASE_URL belum dikonfigurasi');
  if (!key) throw new Error('VITE_SUPABASE_ANON_KEY belum dikonfigurasi');

  _client = createClient(url, key);
  return _client;
}

/** Reset singleton — hanya untuk tes. */
export function _resetClientForTests(): void {
  _client = null;
}
```

- [ ] **Step 4: Sederhanakan tes agar tidak bergantung `vi.resetModules`**

Ganti isi `tests/supabaseClient.test.ts` dengan:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn().mockReturnValue({ from: vi.fn() }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import { getSupabaseClient, _resetClientForTests } from '../src/lib/supabaseClient';

describe('getSupabaseClient', () => {
  const origEnv = import.meta.env;

  beforeEach(() => {
    _resetClientForTests();
    createClientMock.mockClear();
  });

  afterEach(() => {
    // @ts-ignore
    import.meta.env = origEnv;
  });

  it('melempar error bila VITE_SUPABASE_URL tidak di-set', () => {
    // @ts-ignore
    import.meta.env = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'key' };
    expect(() => getSupabaseClient()).toThrow('VITE_SUPABASE_URL');
  });

  it('mengembalikan client bila env terkonfigurasi', () => {
    // @ts-ignore
    import.meta.env = {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-test',
    };
    const client = getSupabaseClient();
    expect(client).toBeDefined();
    expect(createClientMock).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'anon-key-test',
    );
  });

  it('mengembalikan instance yang sama (singleton)', () => {
    // @ts-ignore
    import.meta.env = {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-test',
    };
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).toBe(b);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Jalankan tes — pastikan lulus**

Run: `npm test -- supabaseClient`
Expected: PASS (3 tes).

- [ ] **Step 6: Jalankan seluruh tes (regresi)**

Run: `npm test`
Expected: 43 lama + 3 baru = 46 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabaseClient.ts tests/supabaseClient.test.ts
git commit -m "feat(pakta): supabaseClient anon-key singleton + tes"
```

---

## Task 4: `paktaStore.ts` — jalur data publik

Tiga fungsi yang dibutuhkan halaman `/ttd/:id` (Plan 4):
- `getAcaraPakta(id)` — ambil data acara + fields
- `listSigners(eventId)` — daftar pegawai dengan status
- `updateSignerDone(signerId, pdfPath)` — tandai sudah + simpan path PDF

**Files:**
- Create: `src/lib/paktaStore.ts`
- Create: `tests/paktaStore.test.ts`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/paktaStore.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PaktaTemplate } from '../src/types';

// ---- mock supabaseClient ----
const selectMock  = vi.fn();
const updateMock  = vi.fn();
const eqEventMock = vi.fn();
const eqSignerMock = vi.fn();
const singleMock  = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === 'pakta_events') {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleMock }),
          single: singleMock,
        }),
      }),
    };
  }
  if (table === 'pakta_signers') {
    return {
      select: selectMock,
      update: updateMock,
    };
  }
  return {};
});

vi.mock('../src/lib/supabaseClient', () => ({
  getSupabaseClient: vi.fn().mockReturnValue({ from: fromMock }),
}));

import { getAcaraPakta, listSigners, updateSignerDone } from '../src/lib/paktaStore';

describe('getAcaraPakta', () => {
  beforeEach(() => {
    singleMock.mockReset();
    fromMock.mockClear();
  });

  it('mengembalikan PaktaTemplate bila acara ditemukan dan aktif', async () => {
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

    const result = await getAcaraPakta('ev1');
    // WHY: fungsi harus mengembalikan PaktaTemplate (background diisi setelah template_path diketahui)
    expect(result).not.toBeNull();
    expect(result!.bgWidth).toBe(800);
    expect(result!.bgHeight).toBe(600);
    expect(result!.fields).toHaveLength(1);
  });

  it('mengembalikan null bila acara tidak ditemukan (error Supabase)', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const result = await getAcaraPakta('tidak-ada');
    // WHY: halaman publik harus handle acara tidak ada dengan graceful
    expect(result).toBeNull();
  });

  it('mengembalikan null bila acara berstatus ditutup', async () => {
    singleMock.mockResolvedValue({
      data: { id: 'ev2', status: 'ditutup', bg_width: 800, bg_height: 600, fields: [] },
      error: null,
    });
    const result = await getAcaraPakta('ev2');
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

- [ ] **Step 2: Jalankan tes — pastikan gagal**

Run: `npm test -- paktaStore`
Expected: FAIL — modul tidak ada.

- [ ] **Step 3: Implementasi `src/lib/paktaStore.ts`**

```ts
import type { PaktaTemplate } from '../types';
import { getSupabaseClient } from './supabaseClient';

export interface SignerRow {
  id: string;
  event_id: string;
  nama: string;
  nip: string;
  jabatan: string;
  data: Record<string, string>;
  status: 'belum' | 'sudah';
  signed_at: string | null;
  pdf_path: string | null;
}

/**
 * Ambil data acara pakta untuk halaman tanda tangan publik.
 * Mengembalikan null bila acara tidak ditemukan atau sudah ditutup.
 * Catatan: background belum diisi di sini (diunduh terpisah di Plan 4).
 */
export async function getAcaraPakta(id: string): Promise<
  (PaktaTemplate & { eventId: string; nama: string; tanggal: string; templatePath: string }) | null
> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('pakta_events')
    .select('id, nama, tanggal, template_path, bg_width, bg_height, fields, status')
    .eq('id', id)
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

/** Ambil semua penandatangan untuk satu acara (untuk UI pilih nama). */
export async function listSigners(eventId: string): Promise<SignerRow[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('pakta_signers')
    .select('id, event_id, nama, nip, jabatan, data, status, signed_at, pdf_path')
    .eq('event_id', eventId);

  if (error || !data) return [];
  return data as SignerRow[];
}

/**
 * Tandai signer sudah menandatangani + simpan path PDF.
 * RLS di Supabase memblokir update bila status sudah 'sudah'.
 */
export async function updateSignerDone(signerId: string, pdfPath: string): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb
    .from('pakta_signers')
    .update({
      status: 'sudah',
      pdf_path: pdfPath,
      signed_at: new Date().toISOString(),
    })
    .eq('id', signerId);

  if (error) throw new Error(`Gagal menyimpan tanda tangan: ${error.message}`);
}
```

- [ ] **Step 4: Jalankan tes — pastikan lulus**

Run: `npm test -- paktaStore`
Expected: PASS (6 tes).

- [ ] **Step 5: Regresi penuh**

Run: `npm test`
Expected: 46 lama + 6 baru = 52 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/paktaStore.ts tests/paktaStore.test.ts
git commit -m "feat(pakta): paktaStore publik — getAcaraPakta, listSigners, updateSignerDone"
```

---

## Task 5: `api/pakta-admin.ts` — endpoint admin terlindungi sandi

Endpoint ini menangani semua operasi admin via POST dengan `action` sebagai router internal. Verifikasi sandi dengan `crypto.timingSafeEqual`.

**Files:**
- Create: `api/pakta-admin.ts`
- Create: `tests/paktaAdmin.test.ts`

- [ ] **Step 1: Tulis tes yang gagal**

Buat `tests/paktaAdmin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock Supabase service-role client ----
const fromAdminMock  = vi.fn();
const insertMock     = vi.fn();
const selectAdminMock = vi.fn();
const eqAdminMock    = vi.fn();
const singleAdminMock = vi.fn();
const updateAdminMock = vi.fn();

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn().mockReturnValue({ from: fromAdminMock }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import handler from '../api/pakta-admin';

function mockReq(body: unknown, password = 'sandi-test'): any {
  return {
    method: 'POST',
    headers: { 'x-pakta-admin': password },
    body,
  };
}

function mockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

describe('pakta-admin handler', () => {
  beforeEach(() => {
    createClientMock.mockClear();
    fromAdminMock.mockClear();
    process.env.PAKTA_ADMIN_PASSWORD = 'sandi-test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test';
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  });

  // WHY: hanya POST yang boleh memicu operasi admin.
  it('menolak metode selain POST', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {}, body: {} } as any, res);
    expect(res.statusCode).toBe(405);
  });

  // WHY: sandi salah harus ditolak sebelum menyentuh Supabase.
  it('menolak sandi salah', async () => {
    const res = mockRes();
    await handler(mockReq({ action: 'list_events' }, 'sandi-salah'), res);
    expect(res.statusCode).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  // WHY: action tidak dikenal harus ditolak — tidak boleh ada operasi tak terduga.
  it('menolak action tidak dikenal', async () => {
    fromAdminMock.mockReturnValue({ select: vi.fn().mockReturnValue({ data: [], error: null }) });
    const res = mockRes();
    await handler(mockReq({ action: 'hapus_semua' }), res);
    expect(res.statusCode).toBe(400);
  });

  // WHY: list_events harus mengembalikan semua acara pakta untuk dashboard admin.
  it('list_events mengembalikan data acara', async () => {
    const events = [{ id: 'ev1', nama: 'Pakta 2026', status: 'aktif' }];
    fromAdminMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: events, error: null }),
      }),
    });
    const res = mockRes();
    await handler(mockReq({ action: 'list_events' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.events).toEqual(events);
  });

  // WHY: tanpa SUPABASE_SERVICE_ROLE_KEY server tidak boleh beroperasi.
  it('menolak bila SUPABASE_SERVICE_ROLE_KEY tidak ada', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = mockRes();
    await handler(mockReq({ action: 'list_events' }), res);
    expect(res.statusCode).toBe(500);
  });

  // WHY: create_event harus menyimpan acara baru dan mengembalikan id-nya.
  it('create_event menyimpan acara dan mengembalikan id', async () => {
    const newEvent = { id: 'ev-new', nama: 'Pakta Baru', status: 'aktif' };
    const selectFn = vi.fn().mockResolvedValue({ data: [newEvent], error: null });
    fromAdminMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({ select: selectFn }),
    });
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
    expect(res.body.event.id).toBe('ev-new');
  });

  // WHY: import_signers harus memproses array pegawai dan menyimpan semuanya.
  it('import_signers menyimpan daftar pegawai', async () => {
    fromAdminMock.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    const res = mockRes();
    await handler(mockReq({
      action: 'import_signers',
      event_id: 'ev1',
      signers: [
        { nama: 'Budi', nip: '123', jabatan: 'Staf' },
        { nama: 'Ani',  nip: '456', jabatan: 'Kabag' },
      ],
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.imported).toBe(2);
  });
});
```

- [ ] **Step 2: Jalankan tes — pastikan gagal**

Run: `npm test -- paktaAdmin`
Expected: FAIL — modul tidak ada.

- [ ] **Step 3: Implementasi `api/pakta-admin.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

function verifyPassword(provided: string): boolean {
  const expected = process.env.PAKTA_ADMIN_PASSWORD ?? '';
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function makeAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase belum dikonfigurasi di server');
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const provided = (req.headers['x-pakta-admin'] as string) ?? '';
  if (!verifyPassword(provided)) {
    return res.status(401).json({ error: 'Tidak diizinkan' });
  }

  let sb: ReturnType<typeof makeAdmin>;
  try {
    sb = makeAdmin();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = body.action as string | undefined;

  switch (action) {
    case 'list_events': {
      const { data, error } = await sb
        .from('pakta_events')
        .select('id, nama, tanggal, status, created_at')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ events: data });
    }

    case 'create_event': {
      const { nama, tanggal, template_path, bg_width, bg_height, fields } = body as {
        nama: string; tanggal: string; template_path?: string;
        bg_width: number; bg_height: number; fields: unknown[];
      };
      if (!nama || !tanggal) {
        return res.status(400).json({ error: 'nama dan tanggal wajib diisi' });
      }
      const { data, error } = await sb
        .from('pakta_events')
        .insert({ nama, tanggal, template_path: template_path ?? null, bg_width, bg_height, fields })
        .select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ event: data?.[0] ?? null });
    }

    case 'update_event': {
      const { id, ...patch } = body as { id: string; [k: string]: unknown };
      if (!id) return res.status(400).json({ error: 'id acara wajib diisi' });
      const { error } = await sb.from('pakta_events').update(patch).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    case 'get_event': {
      const { id } = body as { id: string };
      if (!id) return res.status(400).json({ error: 'id acara wajib diisi' });
      const { data, error } = await sb
        .from('pakta_events')
        .select('*, pakta_signers(id, nama, nip, jabatan, status, signed_at, pdf_path)')
        .eq('id', id)
        .single();
      if (error) return res.status(404).json({ error: 'Acara tidak ditemukan' });
      return res.status(200).json({ event: data });
    }

    case 'import_signers': {
      const { event_id, signers } = body as {
        event_id: string;
        signers: { nama: string; nip?: string; jabatan?: string; data?: Record<string, string> }[];
      };
      if (!event_id || !Array.isArray(signers) || signers.length === 0) {
        return res.status(400).json({ error: 'event_id dan signers wajib diisi' });
      }
      const rows = signers.map(s => ({
        event_id,
        nama: s.nama,
        nip: s.nip ?? '',
        jabatan: s.jabatan ?? '',
        data: s.data ?? {},
      }));
      const { error } = await sb.from('pakta_signers').insert(rows);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ imported: rows.length });
    }

    case 'get_signed_url': {
      const { path } = body as { path: string };
      if (!path) return res.status(400).json({ error: 'path wajib diisi' });
      const { data, error } = await sb.storage
        .from('pakta-documents')
        .createSignedUrl(path, 3600);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ url: data.signedUrl });
    }

    default:
      return res.status(400).json({ error: `Action tidak dikenal: ${action}` });
  }
}
```

- [ ] **Step 4: Jalankan tes — pastikan lulus**

Run: `npm test -- paktaAdmin`
Expected: PASS (7 tes).

- [ ] **Step 5: Regresi penuh + tsc**

Run: `npm test && npx tsc -b`
Expected: 52 lama + 7 baru = 59 PASS; tsc 0 error.

- [ ] **Step 6: Commit**

```bash
git add api/pakta-admin.ts tests/paktaAdmin.test.ts
git commit -m "feat(pakta): api/pakta-admin endpoint admin terlindungi sandi + tes"
```

---

## Verifikasi Akhir Rencana 2

- [ ] `npm test` → semua tes hijau (target: 59)
- [ ] `npx tsc -b` → 0 error
- [ ] `npm run build` → berhasil
- [ ] `cat .env.example` → berisi semua env var yang diperlukan
- [ ] `supabase/migrations/0001_pakta_init.sql` ada dan lengkap (DDL + RLS + bucket)

**Kesiapan untuk Rencana 3:** Rencana 3 (UI Admin) bisa memanggil `fetch('/api/pakta-admin', { method:'POST', headers:{'x-pakta-admin': sandi}, body: JSON.stringify({ action: 'list_events' }) })` untuk mendapatkan daftar acara. Rencana 4 (halaman publik) bisa memanggil `getAcaraPakta(id)` dan `listSigners(eventId)` langsung.

---

## Self-Review (penulis rencana)

- **Cakupan spec §3.1 (jalur publik anon):** `supabaseClient.ts` (anon key) + `paktaStore.ts` (getAcaraPakta, listSigners, updateSignerDone). ✔
- **Cakupan spec §3.2 (jalur admin service-role via /api):** `api/pakta-admin.ts` dengan verifikasi sandi + 6 actions. ✔
- **Cakupan spec §4 (model data):** `0001_pakta_init.sql` mendefinisikan `pakta_events`, `pakta_signers`, bucket, RLS. ✔
- **Cakupan spec §6 (error handling):** pesan BI, sandi salah 401, env kosong 500, action tidak dikenal 400, Supabase error 500. ✔
- **Placeholder:** tidak ada TBD/TODO. ✔
- **Konsistensi tipe:** `SignerRow`, `PaktaTemplate` + `eventId/nama/tanggal/templatePath` extension konsisten antara paktaStore dan Plan 4. ✔
- **Service-role key:** hanya muncul di `api/pakta-admin.ts`, TIDAK di `src/`. ✔
- **Dep baru:** hanya `@supabase/supabase-js` (Task 1). ✔

## Rencana berikutnya (belum ditulis)
- **Rencana 3:** UI Admin — daftar acara pakta, editor (reuse + field ttd), impor pegawai, dashboard status + QR code.
- **Rencana 4:** Halaman publik `/ttd/:id` — pilih nama → pra-isi → canvas tanda tangan → kirim (renderPakta + upload) → unduh mandiri + routing.
