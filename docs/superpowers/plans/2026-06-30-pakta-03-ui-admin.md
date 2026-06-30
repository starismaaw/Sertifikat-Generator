# Pakta Integritas — Rencana 3: UI Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun UI admin lengkap untuk mengelola acara Pakta Integritas — login, buat acara, editor template, impor daftar pegawai, dan dashboard status tanda tangan + QR code.

**Architecture:** Admin mengakses `#pakta-admin` di SPA yang sama. Password disimpan di React Context (session only — hilang saat refresh). Semua operasi Supabase melalui `api/pakta-admin.ts`. EditorCanvas + FieldProperties sertifikat di-reuse via adapter `paktaToCertEvent`. Bucket `pakta-templates` dijadikan public untuk URL langsung tanpa signed URL unduhan.

**Tech Stack:** React 18 + TypeScript, Supabase anon/service-role via `/api`, `qrcode` (QR code), `react-konva` (editor canvas, sudah ada), `papaparse`/`xlsx` (import CSV/Excel, sudah ada), css class `apple-*` + `sg-*` yang sudah ada.

**Cakupan spec:** §5.3 (admin UI), §5.4 (editor pakta), §5.5 (import pegawai), §5.6 (dashboard + QR + download).

---

## Pra-syarat Manual (lakukan sebelum implementasi)

Di Supabase dashboard:
1. **Settings → Storage → pakta-templates** → toggle **"Public bucket"** = ON
   - WHY: template gambar bukan data sensitif; URL publik menyederhanakan editor tanpa signed download URL
2. Pastikan SQL migration `0001_pakta_init.sql` sudah dijalankan (Plan 2)

---

## Struktur File

| File | Tanggung jawab | Aksi |
|---|---|---|
| `api/pakta-admin.ts` | Tambah action `get_template_upload_url` | Modify |
| `tests/paktaAdmin.test.ts` | Tambah tes action baru | Modify |
| `src/components/editor/FieldProperties.tsx` | Tambah input `tinggi` untuk field `tandaTangan` | Modify |
| `src/contexts/PaktaAdminContext.tsx` | Password state + helper `callAdmin(action, body)` | Create |
| `src/components/AppRouter.tsx` | Tambah view `pakta-admin`, `pakta-editor`, `pakta-dashboard` | Modify |
| `src/components/pakta-admin/AdminLogin.tsx` | Form login sandi admin | Create |
| `src/components/pakta-admin/PaktaEventList.tsx` | Daftar acara + tombol buat baru | Create |
| `src/components/pakta-admin/NewPaktaEventModal.tsx` | Modal buat acara (upload template, nama, tanggal) | Create |
| `src/components/pakta-admin/PaktaPalette.tsx` | Palet field pakta (nama, nip, jabatan, tandaTangan) | Create |
| `src/components/pakta-admin/PaktaEditor.tsx` | Editor template pakta (reuse EditorCanvas + FieldProperties) | Create |
| `src/components/pakta-admin/ImportSignersModal.tsx` | Modal impor pegawai CSV/Excel → API import_signers | Create |
| `src/components/pakta-admin/PaktaDashboard.tsx` | Status tanda tangan, QR code, tabel signer, unduh PDF | Create |
| `src/App.tsx` | Render view pakta-admin | Modify |

---

## Global Constraints

- `SUPABASE_SERVICE_ROLE_KEY` TIDAK PERNAH di `src/` — hanya lewat `api/pakta-admin.ts`
- Password admin disimpan di React Context saja (bukan localStorage)
- Gunakan class `apple-*` dan `sg-*` yang sudah ada — jangan tambah CSS baru kecuali benar-benar perlu
- Semua teks UI dalam **Bahasa Indonesia**
- Branch `claude/wonderful-solomon-6652df` — jangan pindah
- `npm test && npx tsc -b` harus hijau setelah setiap commit

---

## Task 1: Tambah `get_template_upload_url` ke API + tes

**Files:**
- Modify: `api/pakta-admin.ts`
- Modify: `tests/paktaAdmin.test.ts`

- [ ] **Step 1: Baca file yang akan dimodifikasi**

```bash
cat api/pakta-admin.ts | grep -n "case\|default:"
cat tests/paktaAdmin.test.ts | tail -20
```

Expected: terlihat daftar case yang ada, dan akhir file tes.

- [ ] **Step 2: Tambah case `get_template_upload_url` ke switch di `api/pakta-admin.ts`**

Temukan baris `default:` di akhir switch dan tambahkan case baru **sebelumnya**:

```ts
    case 'get_template_upload_url': {
      const { path } = body as { path: string };
      if (!path) return res.status(400).json({ error: 'path wajib diisi' });
      const { data, error } = await sb.storage
        .from('pakta-templates')
        .createSignedUploadUrl(path);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ signedUrl: data.signedUrl });
    }
```

- [ ] **Step 3: Tambah satu tes untuk action baru di `tests/paktaAdmin.test.ts`**

Tambahkan di dalam `describe('pakta-admin handler', ...)`, setelah tes `import_signers`:

```ts
  // WHY: upload template gambar harus lewat signed URL agar file langsung ke Supabase Storage.
  it('get_template_upload_url mengembalikan signedUrl', async () => {
    fromAdminMock.mockReturnValue({
      from: vi.fn().mockReturnValue({
        createSignedUploadUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.supabase.co/upload/signed?token=abc' },
          error: null,
        }),
      }),
    });
    // Supabase storage mock via sb.storage.from(...).createSignedUploadUrl
    // Patch: mock di level createClientMock sehingga sb.storage tersedia
    createClientMock.mockReturnValue({
      from: fromAdminMock,
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUploadUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://storage.supabase.co/upload/signed?token=abc' },
            error: null,
          }),
        }),
      },
    });
    const res = mockRes();
    await handler(mockReq({ action: 'get_template_upload_url', path: 'events/ev1/template.png' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.signedUrl).toContain('token=abc');
  });
```

- [ ] **Step 4: Jalankan tes — pastikan lulus**

```bash
npm test -- paktaAdmin
```

Expected: 8/8 PASS.

- [ ] **Step 5: Regresi penuh**

```bash
npm test && npx tsc -b
```

Expected: semua tes hijau, tsc 0 error.

- [ ] **Step 6: Commit**

```bash
git add api/pakta-admin.ts tests/paktaAdmin.test.ts
git commit -m "feat(pakta): tambah get_template_upload_url ke admin API"
```

---

## Task 2: Tambah `tinggi` input ke FieldProperties untuk field `tandaTangan`

**Files:**
- Modify: `src/components/editor/FieldProperties.tsx`

- [ ] **Step 1: Baca FieldProperties**

```bash
cat src/components/editor/FieldProperties.tsx
```

Temukan fungsi `FieldTab` dan bagian yang merender properti field (input x, y, lebar, ukuran, dll).

- [ ] **Step 2: Tambah input `tinggi` di FieldTab**

Di dalam `FieldTab`, temukan blok properti posisi/ukuran (bagian yang merender `x`, `y`, `lebar`). Tambahkan input `tinggi` tepat setelah input `lebar`, **hanya ditampilkan bila `selected.tipe === 'tandaTangan'`**:

```tsx
{selected.tipe === 'tandaTangan' && (
  <div className="sg-form-group">
    <label className="sg-label">Tinggi tanda tangan (px)</label>
    <input
      className="sg-input"
      type="number"
      min="10"
      value={selected.tinggi ?? Math.round(selected.lebar / 2)}
      onChange={e => onField({ tinggi: safeNum(e.target.value, selected.lebar / 2) })}
    />
  </div>
)}
```

- [ ] **Step 3: Periksa TypeScript**

```bash
npx tsc -b
```

Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/FieldProperties.tsx
git commit -m "feat(pakta): tambah input tinggi untuk field tandaTangan di FieldProperties"
```

---

## Task 3: PaktaAdminContext + AppRouter extension

**Files:**
- Create: `src/contexts/PaktaAdminContext.tsx`
- Modify: `src/components/AppRouter.tsx`

- [ ] **Step 1: Buat `src/contexts/PaktaAdminContext.tsx`**

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

interface PaktaAdminCtx {
  password: string;
  setPassword: (p: string) => void;
  isLoggedIn: boolean;
  callAdmin: <T = unknown>(action: string, body?: Record<string, unknown>) => Promise<T>;
  logout: () => void;
}

const Ctx = createContext<PaktaAdminCtx | null>(null);

export function PaktaAdminProvider({ children }: { children: ReactNode }) {
  const [password, setPasswordState] = useState('');

  function setPassword(p: string) {
    setPasswordState(p);
  }

  function logout() {
    setPasswordState('');
  }

  async function callAdmin<T = unknown>(
    action: string,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    const res = await fetch('/api/pakta-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pakta-admin': password,
      },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data as T;
  }

  return (
    <Ctx.Provider value={{
      password,
      setPassword,
      isLoggedIn: password.length > 0,
      callAdmin,
      logout,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePaktaAdmin(): PaktaAdminCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePaktaAdmin must be used inside PaktaAdminProvider');
  return ctx;
}
```

- [ ] **Step 2: Modifikasi `src/components/AppRouter.tsx`**

Tambahkan tipe view baru dan fungsi navigate. Baca file saat ini dulu, lalu ganti seluruh isinya:

```tsx
import { useEffect, useState } from 'react';

export type View =
  | { name: 'home' }
  | { name: 'editor'; eventId: string }
  | { name: 'generate'; eventId: string }
  | { name: 'pakta-admin' }
  | { name: 'pakta-editor'; eventId: string }
  | { name: 'pakta-dashboard'; eventId: string };

function parseHash(): View {
  const h = window.location.hash.replace(/^#/, '');
  const [name, id] = h.split('/');
  if (name === 'editor' && id)           return { name: 'editor', eventId: id };
  if (name === 'generate' && id)         return { name: 'generate', eventId: id };
  if (name === 'pakta-admin')            return { name: 'pakta-admin' };
  if (name === 'pakta-editor' && id)     return { name: 'pakta-editor', eventId: id };
  if (name === 'pakta-dashboard' && id)  return { name: 'pakta-dashboard', eventId: id };
  return { name: 'home' };
}

export function navigate(view: View): void {
  if (view.name === 'home')              window.location.hash = '';
  else if (view.name === 'pakta-admin') window.location.hash = 'pakta-admin';
  else window.location.hash = `${view.name}/${view.eventId}`;
}

export function useView(): View {
  const [view, setView] = useState<View>(parseHash);
  useEffect(() => {
    const onChange = () => setView(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return view;
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc -b
```

Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/PaktaAdminContext.tsx src/components/AppRouter.tsx
git commit -m "feat(pakta): PaktaAdminContext + AppRouter view pakta-admin/editor/dashboard"
```

---

## Task 4: AdminLogin

**Files:**
- Create: `src/components/pakta-admin/AdminLogin.tsx`

- [ ] **Step 1: Buat direktori dan file**

```bash
mkdir -p src/components/pakta-admin
```

Buat `src/components/pakta-admin/AdminLogin.tsx`:

```tsx
import { useState } from 'react';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';

export function AdminLogin() {
  const { setPassword, callAdmin } = usePaktaAdmin();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!input.trim()) { setError('Sandi tidak boleh kosong'); return; }
    setLoading(true);
    setError('');
    // Temporarily set password to test it
    // We do a cheap list_events call to verify
    try {
      const res = await fetch('/api/pakta-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pakta-admin': input },
        body: JSON.stringify({ action: 'list_events' }),
      });
      if (!res.ok) throw new Error('Sandi salah');
      setPassword(input);
    } catch {
      setError('Sandi tidak valid. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apple-page apple-page-compact" style={{ maxWidth: 400, paddingTop: 80 }}>
      <div className="apple-card">
        <div className="apple-card-header">
          <h1 className="apple-h2">Admin Pakta Integritas</h1>
          <p className="apple-caption" style={{ marginTop: 4 }}>
            Masukkan sandi untuk mengakses dasbor admin.
          </p>
        </div>
        <div className="apple-card-body">
          {error && <p className="apple-error" style={{ marginBottom: 12 }}>{error}</p>}
          <div className="apple-form-group">
            <label className="apple-label" htmlFor="admin-password">Sandi Admin</label>
            <input
              id="admin-password"
              className="apple-input"
              type="password"
              value={input}
              autoFocus
              placeholder="Masukkan sandi"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button
            className="apple-btn apple-btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
            onClick={handleLogin}
          >
            {loading ? 'Memverifikasi…' : 'Masuk'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc -b
```

Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add src/components/pakta-admin/AdminLogin.tsx
git commit -m "feat(pakta): AdminLogin — verifikasi sandi via API"
```

---

## Task 5: NewPaktaEventModal + PaktaEventList

**Files:**
- Create: `src/components/pakta-admin/NewPaktaEventModal.tsx`
- Create: `src/components/pakta-admin/PaktaEventList.tsx`

- [ ] **Step 1: Buat `src/components/pakta-admin/NewPaktaEventModal.tsx`**

```tsx
import { useRef, useState } from 'react';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { navigate } from '../AppRouter';

function measureImage(file: File): Promise<{ w: number; h: number; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, dataUrl: src });
      img.onerror = reject;
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function NewPaktaEventModal({ onClose }: { onClose: () => void }) {
  const { callAdmin } = usePaktaAdmin();
  const [nama, setNama] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.type.startsWith('image/')) {
      setError('File harus berupa gambar (PNG atau JPG)');
      return;
    }
    setError('');
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleSave() {
    if (!file) { setError('Pilih gambar latar terlebih dahulu'); return; }
    if (!nama.trim()) { setError('Nama acara wajib diisi'); return; }
    setLoading(true);
    setError('');
    try {
      const { w, h } = await measureImage(file);
      const ext = file.name.endsWith('.png') ? 'png' : 'jpg';
      const path = `events/${crypto.randomUUID()}/template.${ext}`;

      // 1. Dapatkan signed upload URL
      const { signedUrl } = await callAdmin<{ signedUrl: string }>('get_template_upload_url', { path });

      // 2. Upload gambar langsung ke Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Gagal mengunggah gambar template');

      // 3. Buat acara di Supabase
      const { event } = await callAdmin<{ event: { id: string } }>('create_event', {
        nama: nama.trim(),
        tanggal,
        template_path: path,
        bg_width: w,
        bg_height: h,
        fields: [],
      });

      navigate({ name: 'pakta-editor', eventId: event.id });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sg-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sg-modal" role="dialog" aria-modal="true" aria-labelledby="modal-pakta-title">
        <div className="sg-modal-header">
          <h2 className="sg-modal-title" id="modal-pakta-title">Buat Acara Pakta Integritas</h2>
          <button className="sg-modal-close" onClick={onClose} aria-label="Tutup">×</button>
        </div>
        <div className="sg-modal-body">
          {error && <div className="apple-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="sg-form-group">
            <label className="sg-label">Gambar latar pakta</label>
            <div className="sg-upload-row">
              <div className="sg-upload-preview">
                {preview
                  ? <img src={preview} alt="Preview latar" />
                  : <span style={{ fontSize: 12, color: 'var(--color-ink-faint)' }}>Pratinjau</span>}
              </div>
              <div
                className={`sg-upload-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="sg-upload-zone-text">
                  Seret gambar ke sini atau{' '}
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>pilih file</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-ink-faint)' }}>PNG atau JPG</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </div>

          <div className="sg-form-group">
            <label className="sg-label" htmlFor="pakta-nama">Nama acara</label>
            <input
              id="pakta-nama"
              className="sg-input"
              value={nama}
              onChange={e => setNama(e.target.value)}
              placeholder="Contoh: Pakta Integritas 2026"
              autoFocus
            />
          </div>

          <div className="sg-form-group">
            <label className="sg-label" htmlFor="pakta-tanggal">Tanggal acara</label>
            <input
              id="pakta-tanggal"
              className="sg-input"
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
            />
          </div>
        </div>
        <div className="sg-modal-footer">
          <button className="sg-btn sg-btn-outline" onClick={onClose} disabled={loading}>Batal</button>
          <button className="sg-btn sg-btn-primary sg-btn-pill" onClick={handleSave} disabled={loading}>
            {loading ? 'Menyimpan…' : 'Simpan & Buka Editor'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Buat `src/components/pakta-admin/PaktaEventList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { navigate } from '../AppRouter';
import { NewPaktaEventModal } from './NewPaktaEventModal';

interface PaktaEvent {
  id: string;
  nama: string;
  tanggal: string;
  status: 'aktif' | 'ditutup';
  created_at: string;
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PaktaCard({ event, onReload }: { event: PaktaEvent; onReload: () => void }) {
  const { callAdmin, logout } = usePaktaAdmin();

  async function toggleStatus() {
    const next = event.status === 'aktif' ? 'ditutup' : 'aktif';
    try {
      await callAdmin('update_event', { id: event.id, status: next });
      onReload();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <article className="apple-card" style={{ marginBottom: 12 }}>
      <div className="apple-card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{event.nama}</div>
          <div className="apple-caption" style={{ color: 'var(--color-ink-muted)' }}>
            {event.tanggal}
            {' · '}
            <span className={`apple-badge ${event.status === 'aktif' ? 'apple-badge-ok' : 'apple-badge-warn'}`}>
              {event.status === 'aktif' ? 'Aktif' : 'Ditutup'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="sg-btn sg-btn-outline"
            onClick={() => navigate({ name: 'pakta-editor', eventId: event.id })}
          >
            Edit Templat
          </button>
          <button
            className="sg-btn sg-btn-primary"
            onClick={() => navigate({ name: 'pakta-dashboard', eventId: event.id })}
          >
            Dashboard
          </button>
          <button className="sg-btn sg-btn-outline" onClick={toggleStatus}>
            {event.status === 'aktif' ? 'Tutup' : 'Buka'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function PaktaEventList() {
  const { callAdmin, logout } = usePaktaAdmin();
  const [events, setEvents] = useState<PaktaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await callAdmin<{ events: PaktaEvent[] }>('list_events');
      setEvents(data.events ?? []);
    } catch (err) {
      setError((err as Error).message);
      if ((err as Error).message.includes('401') || (err as Error).message.includes('diizinkan')) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="apple-page apple-page-compact">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="apple-h1">Pakta Integritas</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sg-btn sg-btn-primary" onClick={() => setShowNew(true)}>
            <PlusIcon /> Buat Acara
          </button>
          <button className="sg-btn sg-btn-outline" onClick={logout}>Keluar</button>
        </div>
      </div>

      {error && <p className="apple-error" style={{ marginBottom: 16 }}>{error}</p>}
      {loading && <p className="apple-caption">Memuat…</p>}
      {!loading && events.length === 0 && (
        <p className="apple-empty">Belum ada acara pakta. Buat acara pertama Anda.</p>
      )}
      {events.map(ev => (
        <PaktaCard key={ev.id} event={ev} onReload={load} />
      ))}

      {showNew && <NewPaktaEventModal onClose={() => { setShowNew(false); load(); }} />}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc -b
```

Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/components/pakta-admin/NewPaktaEventModal.tsx src/components/pakta-admin/PaktaEventList.tsx
git commit -m "feat(pakta): NewPaktaEventModal + PaktaEventList (buat & daftar acara)"
```

---

## Task 6: PaktaPalette + PaktaEditor

**Files:**
- Create: `src/components/pakta-admin/PaktaPalette.tsx`
- Create: `src/components/pakta-admin/PaktaEditor.tsx`

- [ ] **Step 1: Buat `src/components/pakta-admin/PaktaPalette.tsx`**

```tsx
import type { FieldTipe } from '../../types';

const PAKTA_LABELS: Partial<Record<FieldTipe, string>> = {
  nama: 'Nama pegawai',
  nip: 'NIP',
  jabatan: 'Jabatan',
  tandaTangan: 'Tanda Tangan',
};

const PAKTA_FIELDS: FieldTipe[] = ['nama', 'nip', 'jabatan', 'tandaTangan'];

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7.5L6 10.5L11.5 4" stroke="var(--color-accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PaktaPalette({ onAdd, used }: { onAdd: (t: FieldTipe) => void; used: Set<FieldTipe> }) {
  return (
    <div className="sg-field-palette">
      <div>
        <div className="sg-palette-section-header">Field Pakta</div>
        {PAKTA_FIELDS.map(t => {
          const isAdded = used.has(t);
          return (
            <button
              key={t}
              className={`sg-field-btn ${isAdded ? 'added' : ''}`}
              disabled={isAdded}
              onClick={() => !isAdded && onAdd(t)}
            >
              <span style={{ flex: 1, fontSize: 12.5 }}>{PAKTA_LABELS[t]}</span>
              <span className="sg-field-btn-icon">
                {isAdded ? <CheckIcon /> : <PlusIcon />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Buat `src/components/pakta-admin/PaktaEditor.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react';
import type { CertEvent, Field, FieldTipe } from '../../types';
import type { PaktaTemplate } from '../../types';
import { EditorCanvas } from '../editor/EditorCanvas';
import { FieldProperties } from '../editor/FieldProperties';
import { PaktaPalette } from './PaktaPalette';
import { AutoSaveToast } from '../AutoSaveToast';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';

interface PaktaState {
  eventId: string;
  nama: string;
  tanggal: string;
  templatePath: string;
  background: string;
  bgWidth: number;
  bgHeight: number;
  fields: Field[];
}

/** Konversi PaktaState ke CertEvent palsu agar EditorCanvas & FieldProperties bisa dipakai. */
function toFakeCertEvent(ps: PaktaState): CertEvent {
  return {
    id: ps.eventId,
    nama: ps.nama,
    tanggal: ps.tanggal,
    background: ps.background,
    bgWidth: ps.bgWidth,
    bgHeight: ps.bgHeight,
    fields: ps.fields,
    polaNomor: '',
    nomorMulai: 1,
    nomorPadding: 3,
    nomorTerakhir: 0,
    penandatangan: { nama: '', jabatan: '' },
  };
}

function newPaktaField(tipe: FieldTipe, bgWidth: number, bgHeight: number): Field {
  return {
    id: crypto.randomUUID(),
    tipe,
    x: bgWidth * 0.2,
    y: bgHeight * 0.5,
    lebar: bgWidth * 0.6,
    fontFamily: 'Playfair Display',
    fontWeight: 'Regular' as const,
    ukuran: Math.round(bgHeight * 0.04),
    warna: '#000000',
    perataan: 'center',
    formatter: 'none',
    ...(tipe === 'tandaTangan' ? { tinggi: Math.round(bgWidth * 0.6 * 0.4) } : {}),
  };
}

/** Dapatkan public URL gambar template dari Supabase (bucket pakta-templates harus public). */
function templateUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/pakta-templates/${path}`;
}

export function PaktaEditor({ eventId }: { eventId: string }) {
  const { callAdmin } = usePaktaAdmin();
  const [state, setState] = useState<PaktaState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState('');

  const triggerToast = useCallback(() => {
    setToastKey(k => k + 1);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 100);
    setTimeout(() => setShowToast(true), 200);
  }, []);

  useEffect(() => {
    callAdmin<{ event: { id: string; nama: string; tanggal: string; template_path: string; bg_width: number; bg_height: number; fields: Field[] } }>(
      'get_event',
      { id: eventId },
    ).then(({ event: ev }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const background = templateUrl(supabaseUrl, ev.template_path ?? '');
      setState({
        eventId: ev.id,
        nama: ev.nama,
        tanggal: ev.tanggal,
        templatePath: ev.template_path ?? '',
        background,
        bgWidth: ev.bg_width,
        bgHeight: ev.bg_height,
        fields: ev.fields ?? [],
      });
    }).catch(err => setError((err as Error).message));
  }, [eventId]);

  async function save(next: PaktaState) {
    setSaving(true);
    try {
      await callAdmin('update_event', {
        id: next.eventId,
        fields: next.fields,
      });
      triggerToast();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return (
    <div style={{ padding: 40 }}>
      <p className="apple-error" style={{ marginBottom: 12 }}>{error}</p>
      <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
    </div>
  );

  if (!state) return <div style={{ padding: 40 }}><p className="apple-caption">Memuat editor…</p></div>;

  const fakeCertEvent = toFakeCertEvent(state);
  const used = new Set(state.fields.map(f => f.tipe));
  const selectedField = state.fields.find(f => f.id === selectedId);

  function addField(tipe: FieldTipe) {
    const f = newPaktaField(tipe, state!.bgWidth, state!.bgHeight);
    const next = { ...state!, fields: [...state!.fields, f] };
    setState(next);
    save(next);
    setSelectedId(f.id);
  }

  function updateField(id: string, patch: Partial<Field>) {
    const fields = state!.fields.map(f => f.id === id ? { ...f, ...patch } : f);
    const next = { ...state!, fields };
    setState(next);
    save(next);
  }

  function deleteField(id: string) {
    const fields = state!.fields.filter(f => f.id !== id);
    const next = { ...state!, fields };
    setState(next);
    setSelectedId(null);
    save(next);
  }

  return (
    <div className="sg-editor-layout">
      {/* Sidebar kiri: palet */}
      <aside className="sg-editor-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="sg-btn sg-btn-outline" style={{ fontSize: 12 }} onClick={() => navigate({ name: 'pakta-admin' })}>
            ← Kembali
          </button>
          {saving && <span className="apple-caption">Menyimpan…</span>}
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--color-ink-muted)' }}>
          {state.nama}
        </div>
        <PaktaPalette onAdd={addField} used={used} />
      </aside>

      {/* Tengah: kanvas */}
      <main className="sg-editor-main">
        <div className="sg-editor-toolbar">
          <button
            className={`sg-btn sg-btn-icon ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Grid"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1 5h13M1 10h13M5 1v13M10 1v13" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
        <EditorCanvas
          event={fakeCertEvent}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, x, y) => updateField(id, { x, y })}
          showGrid={showGrid}
        />
      </main>

      {/* Sidebar kanan: properties */}
      <aside className="sg-editor-sidebar-right">
        <FieldProperties
          event={fakeCertEvent}
          selected={selectedField}
          onField={patch => selectedId && updateField(selectedId, patch)}
          onEvent={() => {}} // Pakta tidak pakai tab Acara
          onDelete={() => selectedId && deleteField(selectedId)}
        />
      </aside>

      <AutoSaveToast key={toastKey} show={showToast} />
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc -b
```

Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/components/pakta-admin/PaktaPalette.tsx src/components/pakta-admin/PaktaEditor.tsx
git commit -m "feat(pakta): PaktaPalette + PaktaEditor (editor template pakta)"
```

---

## Task 7: ImportSignersModal

**Files:**
- Create: `src/components/pakta-admin/ImportSignersModal.tsx`

- [ ] **Step 1: Buat file**

```tsx
import { useRef, useState } from 'react';
import { parseFile } from '../../lib/dataImporter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';

interface SignerRow {
  nama: string;
  nip: string;
  jabatan: string;
}

const KOLOM_WAJIB = ['nama', 'nip', 'jabatan'] as const;

export function ImportSignersModal({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { callAdmin } = usePaktaAdmin();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<typeof KOLOM_WAJIB[number], string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setError('');
    setSuccess('');
    try {
      const parsed = await parseFile(f);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      // Auto-map kolom dengan nama mirip
      const autoMap: Partial<Record<typeof KOLOM_WAJIB[number], string>> = {};
      for (const col of KOLOM_WAJIB) {
        const found = parsed.headers.find(h =>
          h.toLowerCase().replace(/[^a-z]/g, '').includes(col.toLowerCase())
        );
        if (found) autoMap[col] = found;
      }
      setMapping(autoMap);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function previewRows(): SignerRow[] {
    return rows.slice(0, 5).map(row => ({
      nama: (mapping.nama ? row[mapping.nama] : '') ?? '',
      nip: (mapping.nip ? row[mapping.nip] : '') ?? '',
      jabatan: (mapping.jabatan ? row[mapping.jabatan] : '') ?? '',
    })).filter(r => r.nama.trim());
  }

  async function handleImport() {
    if (!mapping.nama) { setError('Kolom Nama wajib dipetakan'); return; }
    setLoading(true);
    setError('');
    try {
      const signers = rows
        .map(row => ({
          nama: (mapping.nama ? row[mapping.nama] : '') ?? '',
          nip: (mapping.nip ? row[mapping.nip] : '') ?? '',
          jabatan: (mapping.jabatan ? row[mapping.jabatan] : '') ?? '',
        }))
        .filter(s => s.nama.trim());

      if (signers.length === 0) { setError('Tidak ada baris valid ditemukan'); return; }

      const result = await callAdmin<{ imported: number }>('import_signers', { event_id: eventId, signers });
      setSuccess(`${result.imported} pegawai berhasil diimpor.`);
      setRows([]);
      setHeaders([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sg-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sg-modal" style={{ maxWidth: 560 }} role="dialog" aria-modal="true">
        <div className="sg-modal-header">
          <h2 className="sg-modal-title">Impor Daftar Pegawai</h2>
          <button className="sg-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="sg-modal-body">
          {error && <div className="apple-error" style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ color: 'var(--color-accent-green)', marginBottom: 12, fontWeight: 600 }}>{success}</div>}

          <div className="sg-form-group">
            <label className="sg-label">File pegawai (CSV / XLSX)</label>
            <button className="sg-btn sg-btn-outline" onClick={() => fileRef.current?.click()}>
              Pilih File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {headers.length > 0 && (
            <>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Pemetaan Kolom</div>
              {KOLOM_WAJIB.map(k => (
                <div key={k} className="sg-form-group">
                  <label className="sg-label" style={{ textTransform: 'capitalize' }}>{k}</label>
                  <select
                    className="sg-input"
                    value={mapping[k] ?? ''}
                    onChange={e => setMapping(m => ({ ...m, [k]: e.target.value || undefined }))}
                  >
                    <option value="">— Pilih kolom —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}

              {previewRows().length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Pratinjau (5 baris pertama)</div>
                  <div className="apple-table-wrap">
                    <table className="apple-table">
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>NIP</th>
                          <th>Jabatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows().map((r, i) => (
                          <tr key={i}>
                            <td>{r.nama}</td>
                            <td>{r.nip}</td>
                            <td>{r.jabatan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="apple-caption" style={{ marginTop: 8 }}>
                    Total: {rows.filter(r => (mapping.nama ? r[mapping.nama] : '').trim()).length} baris valid
                  </p>
                </>
              )}
            </>
          )}
        </div>
        <div className="sg-modal-footer">
          <button className="sg-btn sg-btn-outline" onClick={onClose} disabled={loading}>Tutup</button>
          {rows.length > 0 && (
            <button
              className="sg-btn sg-btn-primary sg-btn-pill"
              onClick={handleImport}
              disabled={loading || !mapping.nama}
            >
              {loading ? 'Mengimpor…' : `Impor ${rows.filter(r => (mapping.nama ? r[mapping.nama] : '').trim()).length} Pegawai`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc -b
```

Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add src/components/pakta-admin/ImportSignersModal.tsx
git commit -m "feat(pakta): ImportSignersModal — impor CSV/Excel daftar pegawai"
```

---

## Task 8: Install qrcode + PaktaDashboard

**Files:**
- Modify: `package.json` (npm install)
- Create: `src/components/pakta-admin/PaktaDashboard.tsx`

- [ ] **Step 1: Install qrcode**

```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

- [ ] **Step 2: Buat `src/components/pakta-admin/PaktaDashboard.tsx`**

```tsx
import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { navigate } from '../AppRouter';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';
import { ImportSignersModal } from './ImportSignersModal';

interface Signer {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  status: 'belum' | 'sudah';
  signed_at: string | null;
  pdf_path: string | null;
}

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

  const publicUrl = `${window.location.origin}${window.location.pathname}#pakta/${eventId}`;

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

  useEffect(() => { load(); }, [eventId]);

  async function downloadPdf(signer: Signer) {
    if (!signer.pdf_path) return;
    setDownloadingId(signer.id);
    try {
      const { url } = await callAdmin<{ url: string }>('get_signed_url', { path: signer.pdf_path });
      const a = document.createElement('a');
      a.href = url;
      a.download = `pakta-${signer.nama.replace(/\s+/g, '_')}.pdf`;
      a.click();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).catch(() => {});
  }

  if (error) return (
    <div style={{ padding: 40 }}>
      <p className="apple-error" style={{ marginBottom: 12 }}>{error}</p>
      <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
    </div>
  );

  if (loading || !event) return <div style={{ padding: 40 }}><p className="apple-caption">Memuat…</p></div>;

  const signers = event.pakta_signers ?? [];
  const sudahCount = signers.filter(s => s.status === 'sudah').length;
  const totalCount = signers.length;

  return (
    <div className="apple-page apple-page-wide">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="sg-btn sg-btn-outline" onClick={() => navigate({ name: 'pakta-admin' })}>← Kembali</button>
        <div>
          <h1 className="apple-h1" style={{ margin: 0 }}>{event.nama}</h1>
          <span className="apple-caption">{event.tanggal}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 24, alignItems: 'start' }}>
        {/* Kolom kiri: statistik + tabel */}
        <div>
          {/* Statistik */}
          <div className="apple-card" style={{ marginBottom: 16 }}>
            <div className="apple-card-body" style={{ display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700 }}>{sudahCount}/{totalCount}</div>
                <div className="apple-caption">Sudah menandatangani</div>
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700 }}>{totalCount - sudahCount}</div>
                <div className="apple-caption">Belum menandatangani</div>
              </div>
            </div>
          </div>

          {/* Tombol aksi */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="sg-btn sg-btn-outline" onClick={() => setShowImport(true)}>
              Impor Pegawai
            </button>
            <button className="sg-btn sg-btn-outline" onClick={load}>
              Refresh
            </button>
          </div>

          {/* Tabel signer */}
          {signers.length === 0 ? (
            <p className="apple-empty">Belum ada pegawai. Klik "Impor Pegawai" untuk menambahkan.</p>
          ) : (
            <div className="apple-table-wrap">
              <table className="apple-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>NIP</th>
                    <th>Jabatan</th>
                    <th>Status</th>
                    <th>Waktu TTD</th>
                    <th>Unduh</th>
                  </tr>
                </thead>
                <tbody>
                  {signers.map(s => (
                    <tr key={s.id}>
                      <td>{s.nama}</td>
                      <td>{s.nip}</td>
                      <td>{s.jabatan}</td>
                      <td>
                        <span className={`apple-badge ${s.status === 'sudah' ? 'apple-badge-ok' : 'apple-badge-warn'}`}>
                          {s.status === 'sudah' ? 'Sudah' : 'Belum'}
                        </span>
                      </td>
                      <td className="apple-caption">
                        {s.signed_at ? new Date(s.signed_at).toLocaleString('id-ID') : '—'}
                      </td>
                      <td>
                        {s.pdf_path ? (
                          <button
                            className="sg-btn sg-btn-outline"
                            style={{ fontSize: 12, padding: '2px 10px' }}
                            disabled={downloadingId === s.id}
                            onClick={() => downloadPdf(s)}
                          >
                            {downloadingId === s.id ? '…' : 'PDF'}
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Kolom kanan: QR code + link */}
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
      </div>

      {showImport && (
        <ImportSignersModal
          eventId={eventId}
          onClose={() => { setShowImport(false); load(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc -b
```

Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/components/pakta-admin/PaktaDashboard.tsx package.json package-lock.json
git commit -m "feat(pakta): PaktaDashboard — status TTD, QR code, unduh PDF"
```

---

## Task 9: Wire semua ke App.tsx + PaktaAdminProvider

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Baca `src/App.tsx` saat ini**

```bash
cat src/App.tsx
```

- [ ] **Step 2: Ganti isi `src/App.tsx`**

```tsx
import './styles/apple-design.css';
import { useState } from 'react';
import { useView } from './components/AppRouter';
import { EventList } from './components/EventList';
import { CertificateEditor } from './components/editor/CertificateEditor';
import { GenerateView } from './components/generate/GenerateView';
import { AppTopbar, type BreadcrumbItem, type SaveState } from './components/AppTopbar';
import { getEvent } from './lib/eventStore';
import { PaktaAdminProvider, usePaktaAdmin } from './contexts/PaktaAdminContext';
import { AdminLogin } from './components/pakta-admin/AdminLogin';
import { PaktaEventList } from './components/pakta-admin/PaktaEventList';
import { PaktaEditor } from './components/pakta-admin/PaktaEditor';
import { PaktaDashboard } from './components/pakta-admin/PaktaDashboard';

function PaktaAdminRoot() {
  const { isLoggedIn } = usePaktaAdmin();
  const view = useView();

  if (view.name === 'pakta-admin' || view.name === 'pakta-editor' || view.name === 'pakta-dashboard') {
    if (!isLoggedIn) return <AdminLogin />;
    if (view.name === 'pakta-admin')     return <PaktaEventList />;
    if (view.name === 'pakta-editor')    return <PaktaEditor key={view.eventId} eventId={view.eventId} />;
    if (view.name === 'pakta-dashboard') return <PaktaDashboard key={view.eventId} eventId={view.eventId} />;
  }
  return null;
}

export default function App() {
  const view = useView();
  const [saveState] = useState<SaveState>('synced');

  const isPaktaView = view.name === 'pakta-admin' || view.name === 'pakta-editor' || view.name === 'pakta-dashboard';

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

  return (
    <PaktaAdminProvider>
      <div className="apple-app">
        <AppTopbar
          breadcrumbs={breadcrumbs}
          saveState={view.name === 'editor' ? saveState : 'synced'}
        />
        {isPaktaView && <PaktaAdminRoot />}
        {!isPaktaView && view.name === 'home' && <EventList />}
        {!isPaktaView && view.name === 'editor' && <CertificateEditor key={view.eventId} eventId={view.eventId} />}
        {!isPaktaView && view.name === 'generate' && <GenerateView key={view.eventId} eventId={view.eventId} />}
      </div>
    </PaktaAdminProvider>
  );
}
```

- [ ] **Step 3: TypeScript + tes penuh**

```bash
npx tsc -b && npm test
```

Expected: tsc 0 error, semua tes hijau.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: build sukses (warning chunk size bukan blocking).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(pakta): wire UI admin ke App.tsx — login, daftar, editor, dashboard"
```

---

## Verifikasi Akhir Rencana 3

- [ ] `npm test` → semua tes hijau (target: 61, +1 dari Task 1)
- [ ] `npx tsc -b` → 0 error
- [ ] `npm run build` → sukses
- [ ] Di browser: `/#pakta-admin` → muncul form login
- [ ] Login dengan sandi benar → muncul daftar acara (bisa kosong)
- [ ] Buat acara baru → upload template → navigasi ke editor
- [ ] Editor: drag field `tandaTangan` → ada input `tinggi` di properties
- [ ] Dashboard: muncul QR code + tabel signer

**Kesiapan untuk Rencana 4:** URL `/#pakta/<eventId>` siap dipakai di Rencana 4 (halaman publik pegawai) — itulah yang di-QR-code-kan di dashboard.

---

## Self-Review

**Cakupan spec:**
- §5.3 Login admin: Task 4 AdminLogin ✔
- §5.3 Daftar acara: Task 5 PaktaEventList ✔
- §5.3 Buat acara + upload template: Task 5 NewPaktaEventModal ✔
- §5.4 Editor template pakta (reuse editor + PaktaPalette): Task 6 PaktaEditor ✔
- §5.4 Field tandaTangan dengan input tinggi: Task 2 FieldProperties ✔
- §5.5 Impor daftar pegawai CSV/Excel: Task 7 ImportSignersModal ✔
- §5.6 Dashboard status (x/y signed): Task 8 PaktaDashboard ✔
- §5.6 QR code link publik: Task 8 PaktaDashboard ✔
- §5.6 Download PDF per pegawai: Task 8 PaktaDashboard ✔

**Placeholder scan:** Tidak ada TBD/TODO. Semua langkah punya kode lengkap.

**Type consistency:** `PaktaState.fields: Field[]`, `toFakeCertEvent()` menghasilkan `CertEvent` valid, `Signer.status: 'belum' | 'sudah'` konsisten dengan SQL dan `SignerRow` di `paktaStore.ts`.

**Keamanan:** `SUPABASE_SERVICE_ROLE_KEY` tidak ada di `src/`. Password admin di React Context saja. Upload template melalui signed URL (tidak melewati Vercel).
