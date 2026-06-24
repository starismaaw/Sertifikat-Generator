# Pengiriman Sertifikat via Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kirim sertifikat PDF langsung ke email penerima dari mode Massal, dengan preview + konfirmasi, template yang bisa diedit, dan ringkasan berhasil/gagal.

**Architecture:** PDF tetap dibuat di browser (`renderCertificate()` yang sudah ada), dikonversi ke base64, lalu dikirim per-batch kecil ke satu Vercel serverless function (`api/send-certificates.ts`) yang meneruskan ke Resend via `resend.batch.send()`. `RESEND_API_KEY` dan alamat pengirim (`RESEND_FROM`) hanya hidup di env Vercel — tidak pernah masuk ke kode browser.

**Tech Stack:** React 18 + Vite, TypeScript, Vitest, pdf-lib (sudah ada), `resend` (baru), `@vercel/node` (baru, dev).

**Catatan penyimpangan dari spec (Rule 7):** Alamat `from` di-set backend dari `RESEND_FROM`, BUKAN dikirim dari browser. Lebih aman (anti-spoof). Payload klien hanya `{ subject, body, recipients[] }`.

---

## File Structure

**Backend (baru):**
- `api/send-certificates.ts` — Vercel serverless handler. Validasi payload, panggil Resend, kembalikan `{ sent[], failed[] }`.

**Frontend lib (baru, murni & teruji):**
- `src/lib/emailValidation.ts` — `isValidEmail(s)`.
- `src/lib/emailTemplate.ts` — `interpolate(tpl, vars)`, `DEFAULT_TEMPLATE`, `loadTemplate(eventId)`, `saveTemplate(eventId, tpl)`.
- `src/lib/emailSender.ts` — tipe transport, `bytesToBase64`, `sendCertificates(payload, onProgress)`.

**Frontend UI:**
- `src/components/generate/SendEmailPanel.tsx` (baru) — compound component (context provider + TemplateEditor + RecipientTable + SendButton).
- `src/components/generate/ColumnMapper.tsx` (modifikasi) — tambah pemetaan kolom email (opsional, non-field).
- `src/components/generate/GenerateBulk.tsx` (modifikasi) — simpan PDF bytes per baris, bangun daftar penerima, render `SendEmailPanel`.

**Docs:**
- `README.md` (modifikasi) — variabel lingkungan & cara uji lokal (`vercel dev`).

---

## Task 1: Validasi email (`emailValidation.ts`)

**Files:**
- Create: `src/lib/emailValidation.ts`
- Test: `tests/emailValidation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/emailValidation.test.ts
import { describe, it, expect } from 'vitest';
import { isValidEmail } from '../src/lib/emailValidation';

describe('isValidEmail', () => {
  it('menerima alamat email yang wajar', () => {
    expect(isValidEmail('budi@example.com')).toBe(true);
    expect(isValidEmail('a.b-c@sub.domain.go.id')).toBe(true);
  });
  // WHY: baris tanpa email atau salah format tidak boleh dianggap penerima valid,
  // supaya tidak memicu kirim yang pasti gagal / bocor ke alamat salah.
  it('menolak yang kosong / salah format', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('   ')).toBe(false);
    expect(isValidEmail('budi')).toBe(false);
    expect(isValidEmail('budi@')).toBe(false);
    expect(isValidEmail('budi@example')).toBe(false);
    expect(isValidEmail('a b@example.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/emailValidation.test.ts`
Expected: FAIL — "Failed to resolve import '../src/lib/emailValidation'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/emailValidation.ts
// Hoist regex sekali (js-hoist-regexp). Sengaja sederhana: satu @, ada titik di domain,
// tanpa spasi. Validasi nyata dilakukan oleh server email; ini hanya filter UI.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/emailValidation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/emailValidation.ts tests/emailValidation.test.ts
git commit -m "feat: tambah validasi format email untuk pengiriman sertifikat"
```

---

## Task 2: Template email (`emailTemplate.ts`)

**Files:**
- Create: `src/lib/emailTemplate.ts`
- Test: `tests/emailTemplate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/emailTemplate.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { interpolate, DEFAULT_TEMPLATE, loadTemplate, saveTemplate } from '../src/lib/emailTemplate';

describe('interpolate', () => {
  it('mengisi placeholder yang dikenal', () => {
    const out = interpolate('Yth. {nama}, nomor {nomor}', { nama: 'Budi', nomor: '007/X' });
    expect(out).toBe('Yth. Budi, nomor 007/X');
  });
  // WHY: placeholder yang salah ketik tidak boleh menghapus teks / melempar error;
  // biarkan utuh supaya pengguna lihat kesalahannya, bukan kehilangan isi email.
  it('membiarkan placeholder tak dikenal apa adanya', () => {
    expect(interpolate('Halo {tidakada}', { nama: 'Budi' })).toBe('Halo {tidakada}');
  });
});

describe('loadTemplate / saveTemplate', () => {
  beforeEach(() => localStorage.clear());
  it('mengembalikan DEFAULT_TEMPLATE bila belum ada', () => {
    expect(loadTemplate('ev1')).toEqual(DEFAULT_TEMPLATE);
  });
  // WHY: template tersimpan per-acara harus bertahan & terisolasi per event id.
  it('menyimpan & memuat ulang per event id', () => {
    saveTemplate('ev1', { subject: 'S', body: 'B' });
    expect(loadTemplate('ev1')).toEqual({ subject: 'S', body: 'B' });
    expect(loadTemplate('ev2')).toEqual(DEFAULT_TEMPLATE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/emailTemplate.test.ts`
Expected: FAIL — import tidak ditemukan.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/emailTemplate.ts

export interface EmailTemplate { subject: string; body: string; }

/** Versi penyimpanan (client-localstorage-schema) agar aman dievolusi. */
interface StoredTemplate { v: 1; subject: string; body: string; }

export const DEFAULT_TEMPLATE: EmailTemplate = {
  subject: 'Sertifikat {acara}',
  body:
    'Yth. {nama},\n\n' +
    'Bersama email ini kami sampaikan sertifikat dengan nomor {nomor} ' +
    'atas partisipasi Anda dalam {acara}.\n\n' +
    'Sertifikat terlampir dalam format PDF.\n\n' +
    'Hormat kami,\n' +
    'Balai P3KP Jawa III',
};

const PLACEHOLDER_RE = /\{(\w+)\}/g;

/** Ganti {kunci} dengan vars[kunci]; placeholder tak dikenal dibiarkan utuh. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (whole, key) =>
    key in vars ? vars[key] : whole,
  );
}

const keyOf = (eventId: string) => `emailTemplate:${eventId}`;

export function loadTemplate(eventId: string): EmailTemplate {
  try {
    const raw = localStorage.getItem(keyOf(eventId));
    if (!raw) return DEFAULT_TEMPLATE;
    const parsed = JSON.parse(raw) as StoredTemplate;
    if (parsed.v !== 1) return DEFAULT_TEMPLATE;
    return { subject: parsed.subject, body: parsed.body };
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function saveTemplate(eventId: string, tpl: EmailTemplate): void {
  const stored: StoredTemplate = { v: 1, subject: tpl.subject, body: tpl.body };
  localStorage.setItem(keyOf(eventId), JSON.stringify(stored));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/emailTemplate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/emailTemplate.ts tests/emailTemplate.test.ts
git commit -m "feat: tambah template email per-acara dengan interpolasi placeholder"
```

---

## Task 3: Transport pengirim (`emailSender.ts`)

**Files:**
- Create: `src/lib/emailSender.ts`
- Test: `tests/emailSender.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/emailSender.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendCertificates, type OutgoingCertificate } from '../src/lib/emailSender';

function cert(email: string, vars: Record<string, string> = {}): OutgoingCertificate {
  return { nama: 'X', email, filename: 'x.pdf', pdfBytes: new Uint8Array([1, 2, 3]), vars };
}

describe('sendCertificates', () => {
  beforeEach(() => vi.restoreAllMocks());

  // WHY: subjek & badan harus dipersonalisasi PER penerima sebelum dikirim,
  // jika tidak setiap orang menerima literal "{nama}" yang sama.
  it('menginterpolasi subjek & badan per penerima dalam wire payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ sent: [], failed: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await sendCertificates({
      subject: 'Sertifikat {acara}',
      body: 'Yth. {nama}',
      recipients: [cert('a@x.id', { acara: 'Diklat', nama: 'Budi' })],
    });
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.recipients[0].subject).toBe('Sertifikat Diklat');
    expect(sentBody.recipients[0].body).toBe('Yth. Budi');
  });

  // WHY: payload > 1 batch harus dipecah agar tidak menembus limit ukuran Vercel.
  it('memecah penerima menjadi beberapa batch (ukuran 8)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sent: [], failed: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const recipients = Array.from({ length: 10 }, (_, i) => cert(`u${i}@x.id`));
    await sendCertificates({ subject: 'S', body: 'B', recipients });
    expect(fetchMock).toHaveBeenCalledTimes(2); // 8 + 2
  });

  // WHY: hasil tiap batch harus diagregasi jadi satu ringkasan sent/failed.
  it('menggabungkan hasil dari semua batch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        sent: [{ status: 'sent', email: 'a@x.id', id: '1' }], failed: [],
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        sent: [], failed: [{ status: 'failed', email: 'b@x.id', error: 'tolak' }],
      }) });
    vi.stubGlobal('fetch', fetchMock);
    const recipients = Array.from({ length: 9 }, (_, i) => cert(`u${i}@x.id`));
    const summary = await sendCertificates({ subject: 'S', body: 'B', recipients });
    expect(summary.sent).toHaveLength(1);
    expect(summary.failed).toHaveLength(1);
  });

  // WHY: kegagalan jaringan satu batch tidak boleh menjatuhkan seluruh proses;
  // penerima batch itu ditandai gagal, batch lain tetap jalan.
  it('menandai gagal saat fetch error, lanjut batch lain', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        sent: [{ status: 'sent', email: 'b@x.id', id: '1' }], failed: [],
      }) });
    vi.stubGlobal('fetch', fetchMock);
    const recipients = Array.from({ length: 9 }, (_, i) => cert(`u${i}@x.id`));
    const summary = await sendCertificates({ subject: 'S', body: 'B', recipients });
    expect(summary.failed).toHaveLength(8);
    expect(summary.sent).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/emailSender.test.ts`
Expected: FAIL — import tidak ditemukan.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/emailSender.ts
import { interpolate } from './emailTemplate';

/** Satu sertifikat siap kirim (PDF sudah dibuat di browser). */
export interface OutgoingCertificate {
  nama: string;
  email: string;
  filename: string;
  pdfBytes: Uint8Array;
  /** Nilai untuk mengisi placeholder template, mis. { nama, nomor, acara }. */
  vars: Record<string, string>;
}

export interface SendPayload {
  /** Template subjek (boleh berisi placeholder {nama}, dll). */
  subject: string;
  /** Template badan email (boleh berisi placeholder). */
  body: string;
  recipients: OutgoingCertificate[];
}

/** Hasil per-penerima (discriminated union — narrowing aman). */
export type SendResult =
  | { status: 'sent'; email: string; id: string }
  | { status: 'failed'; email: string; error: string };

export interface SendSummary { sent: SendResult[]; failed: SendResult[]; }

const BATCH_SIZE = 8;
const ENDPOINT = '/api/send-certificates';

/** Uint8Array -> base64 tanpa meledakkan stack untuk PDF besar. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Subjek & badan SUDAH diinterpolasi per penerima sebelum dikirim. */
interface WireRecipient {
  email: string; nama: string; filename: string; pdfBase64: string;
  subject: string; body: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Kirim semua sertifikat per-batch ke serverless function.
 * `onProgress(done, total)` dipanggil setelah tiap batch selesai.
 */
export async function sendCertificates(
  payload: SendPayload,
  onProgress?: (done: number, total: number) => void,
): Promise<SendSummary> {
  const summary: SendSummary = { sent: [], failed: [] };
  const batches = chunk(payload.recipients, BATCH_SIZE);
  let done = 0;

  for (const batch of batches) {
    const wire: WireRecipient[] = batch.map(r => ({
      email: r.email,
      nama: r.nama,
      filename: r.filename,
      pdfBase64: bytesToBase64(r.pdfBytes),
      subject: interpolate(payload.subject, r.vars),
      body: interpolate(payload.body, r.vars),
    }));
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: wire }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SendSummary;
      summary.sent.push(...data.sent);
      summary.failed.push(...data.failed);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      for (const r of batch) summary.failed.push({ status: 'failed', email: r.email, error });
    }
    done += batch.length;
    onProgress?.(done, payload.recipients.length);
  }

  return summary;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/emailSender.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/emailSender.ts tests/emailSender.test.ts
git commit -m "feat: tambah transport pengiriman email per-batch dengan agregasi hasil"
```

---

## Task 4: Backend serverless function (`api/send-certificates.ts`)

**Files:**
- Create: `api/send-certificates.ts`
- Test: `tests/sendCertificatesHandler.test.ts`
- Modify: `package.json` (deps `resend`, devDeps `@vercel/node`)

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install resend
npm install -D @vercel/node
```
Expected: keduanya tercatat di `package.json`.

- [ ] **Step 2: Write the failing test**

```typescript
// tests/sendCertificatesHandler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ batch: { send: sendMock } })),
}));

import handler from '../api/send-certificates';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}
// Subjek & badan SUDAH diinterpolasi per penerima oleh klien.
const recipient = { email: 'a@x.id', nama: 'A', filename: 'a.pdf', pdfBase64: 'AAA', subject: 'S', body: 'B' };

describe('send-certificates handler', () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.RESEND_API_KEY = 'key';
    process.env.RESEND_FROM = 'noreply@balai.go.id';
  });

  // WHY: hanya POST yang boleh memicu pengiriman.
  it('menolak metode selain POST', async () => {
    const res = mockRes();
    await handler({ method: 'GET', body: {} } as any, res);
    expect(res.statusCode).toBe(405);
  });

  // WHY: payload kosong harus ditolak sebelum memanggil Resend (early-exit).
  it('menolak recipients kosong', async () => {
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [] } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  // WHY: subjek/badan per penerima dari klien harus diteruskan ke Resend apa adanya.
  it('meneruskan subject & text per penerima ke Resend', async () => {
    sendMock.mockResolvedValue({ data: { data: [{ id: 'id-1' }] }, error: null });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    const arg = sendMock.mock.calls[0][0][0];
    expect(arg).toMatchObject({ to: 'a@x.id', subject: 'S', text: 'B' });
  });

  // WHY: pada sukses, tiap penerima dipetakan ke status 'sent' beserta id.
  it('mengembalikan sent saat Resend sukses', async () => {
    sendMock.mockResolvedValue({ data: { data: [{ id: 'id-1' }] }, error: null });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.sent).toEqual([{ status: 'sent', email: 'a@x.id', id: 'id-1' }]);
    expect(res.body.failed).toEqual([]);
  });

  // WHY: error dari Resend menandai semua penerima batch gagal — TIDAK membocorkan API key.
  it('mengembalikan failed saat Resend error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'kuota habis' } });
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.failed[0]).toMatchObject({ status: 'failed', email: 'a@x.id' });
    expect(JSON.stringify(res.body)).not.toContain('key');
  });

  // WHY: tanpa konfigurasi env, jangan pura-pura kirim — gagalkan jelas.
  it('menolak bila RESEND_API_KEY tidak ada', async () => {
    delete process.env.RESEND_API_KEY;
    const res = mockRes();
    await handler({ method: 'POST', body: { recipients: [recipient] } } as any, res);
    expect(res.statusCode).toBe(500);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/sendCertificatesHandler.test.ts`
Expected: FAIL — `../api/send-certificates` tidak ditemukan.

- [ ] **Step 4: Write minimal implementation**

```typescript
// api/send-certificates.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const MAX_RECIPIENTS = 100; // batas aman per request

// Subjek & badan SUDAH diinterpolasi per penerima oleh klien.
interface WireRecipient {
  email: string; nama: string; filename: string; pdfBase64: string;
  subject: string; body: string;
}
type SendResult =
  | { status: 'sent'; email: string; id: string }
  | { status: 'failed'; email: string; error: string };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return res.status(500).json({ error: 'Email belum dikonfigurasi di server' });

  const { recipients } = (req.body ?? {}) as { recipients?: WireRecipient[] };

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'recipients kosong' });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `Maksimal ${MAX_RECIPIENTS} penerima per permintaan` });
  }
  if (recipients.some(r => !r.email || !r.subject || !r.body)) {
    return res.status(400).json({ error: 'Setiap penerima wajib punya email, subject, dan body' });
  }

  const resend = new Resend(apiKey);
  const sent: SendResult[] = [];
  const failed: SendResult[] = [];

  try {
    const { data, error } = await resend.batch.send(
      recipients.map(r => ({
        from,
        to: r.email,
        subject: r.subject,
        text: r.body,
        attachments: [{ filename: r.filename, content: r.pdfBase64 }],
      })),
    );

    if (error || !data) {
      const message = error?.message ?? 'Pengiriman gagal';
      for (const r of recipients) failed.push({ status: 'failed', email: r.email, error: message });
    } else {
      // data.data berisi id per email, urutannya sama dengan input.
      recipients.forEach((r, i) => {
        const id = data.data[i]?.id;
        if (id) sent.push({ status: 'sent', email: r.email, id });
        else failed.push({ status: 'failed', email: r.email, error: 'Tidak ada id balasan' });
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Kesalahan tidak dikenal';
    for (const r of recipients) failed.push({ status: 'failed', email: r.email, error: message });
  }

  return res.status(200).json({ sent, failed });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/sendCertificatesHandler.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Verify tsconfig excludes `api/` from the browser build**

Read `tsconfig.json`. The Vite app build (`tsc -b`) compiles `src`. Confirm `api/` is NOT in `src` (it is at repo root) and is not picked up by the app's `include`. If the root build globs `api/`, add `"exclude": ["api"]` to the app tsconfig so `@vercel/node` types don't break `npm run build`.

Run: `npm run build`
Expected: PASS (no type errors from `api/`).

- [ ] **Step 7: Commit**

```bash
git add api/send-certificates.ts tests/sendCertificatesHandler.test.ts package.json package-lock.json tsconfig.json
git commit -m "feat: tambah serverless function pengiriman sertifikat via Resend"
```

---

## Task 5: Pemetaan kolom email di `ColumnMapper`

**Files:**
- Modify: `src/components/generate/ColumnMapper.tsx`

ColumnMapper saat ini hanya memetakan `FieldTipe`. Email BUKAN field sertifikat, jadi ditambah sebagai prop terpisah (hindari mengotori `FieldTipe` & render PDF).

- [ ] **Step 1: Add email props and a select, without breaking existing field mapping**

Ganti seluruh isi `src/components/generate/ColumnMapper.tsx`:

```typescript
import type { FieldTipe } from '../../types';
import { FIELD_LABELS } from '../editor/FieldPalette';

const MAPPABLE: FieldTipe[] = ['nama', 'peran'];

export function ColumnMapper({
  headers, mapping, onChange, emailColumn, onEmailChange,
}: {
  headers: string[];
  mapping: Partial<Record<FieldTipe, string>>;
  onChange: (m: Partial<Record<FieldTipe, string>>) => void;
  emailColumn: string;
  onEmailChange: (col: string) => void;
}) {
  return (
    <div className="apple-flex-row apple-gap-md apple-mb-md">
      <h4 className="apple-caption-strong" style={{ minWidth: 100 }}>Pemetaan Kolom</h4>
      {MAPPABLE.map(tipe => (
        <div key={tipe} className="apple-form-group" style={{ marginBottom: 0 }}>
          <label className="apple-label" style={{ marginBottom: 3, fontSize: 12 }}>
            {FIELD_LABELS[tipe]}{tipe === 'nama' && <span className="apple-fine"> *</span>}
          </label>
          <select className="apple-select" value={mapping[tipe] ?? ''}
            onChange={e => onChange({ ...mapping, [tipe]: e.target.value || undefined })}>
            <option value="">— pilih kolom —</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      ))}
      <div className="apple-form-group" style={{ marginBottom: 0 }}>
        <label className="apple-label" style={{ marginBottom: 3, fontSize: 12 }}>
          Email <span className="apple-fine">(untuk pengiriman)</span>
        </label>
        <select className="apple-select" value={emailColumn}
          onChange={e => onEmailChange(e.target.value)}>
          <option value="">— pilih kolom —</option>
          {headers.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check (caller belum dikirim props baru — sengaja gagal sampai Task 7)**

Run: `npx tsc -b --noEmit` *(opsional di titik ini)*
Expected: error "Property 'emailColumn' is missing" di `GenerateBulk.tsx` — akan diperbaiki di Task 7. Lewati commit sampai Task 7 agar build tetap hijau, ATAU lakukan Task 7 segera setelah ini.

> **Catatan urutan:** Task 5 dan Task 7 saling bergantung pada tipe props. Implementasikan keduanya berurutan, lalu commit bersama di akhir Task 7.

---

## Task 6: Komponen `SendEmailPanel` (compound component)

**Files:**
- Create: `src/components/generate/SendEmailPanel.tsx`

Compound component dengan context provider (composition-patterns: `state-lift-state`, `architecture-compound-components`, `useContext` — React 18, bukan `forwardRef`). State kirim diangkat ke provider; anak-anak membaca via context.

- [ ] **Step 1: Write the component**

```typescript
// src/components/generate/SendEmailPanel.tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { isValidEmail } from '../../lib/emailValidation';
import { loadTemplate, saveTemplate } from '../../lib/emailTemplate';
import {
  sendCertificates, type OutgoingCertificate, type SendSummary,
} from '../../lib/emailSender';

type RowStatus = 'valid' | 'invalid-email' | 'sending' | 'sent' | 'failed';
interface PanelRow { cert: OutgoingCertificate; status: RowStatus; error?: string; }
type Phase = 'idle' | 'sending' | 'done';

interface PanelContextValue {
  rows: PanelRow[];
  subject: string;
  body: string;
  setSubject: (s: string) => void;
  setBody: (s: string) => void;
  phase: Phase;
  progress: { done: number; total: number };
  summary: SendSummary | null;
  send: () => Promise<void>;
}

const PanelContext = createContext<PanelContextValue | null>(null);
function usePanel(): PanelContextValue {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('SendEmailPanel.* harus di dalam <SendEmailPanel>');
  return ctx;
}

export function SendEmailPanel({
  eventId, certificates, children,
}: {
  eventId: string;
  certificates: OutgoingCertificate[];
  children: ReactNode;
}) {
  const initial = useMemo(() => loadTemplate(eventId), [eventId]);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<SendSummary | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { status: RowStatus; error?: string }>>({});

  // Status valid di-derive saat render (rerender-derived-state), bukan via useEffect.
  const rows = useMemo<PanelRow[]>(() =>
    certificates.map(cert => {
      const o = overrides[cert.email];
      if (o) return { cert, status: o.status, error: o.error };
      return { cert, status: isValidEmail(cert.email) ? 'valid' : 'invalid-email' };
    }), [certificates, overrides]);

  async function send() {
    const sendable = rows.filter(r => r.status === 'valid' || r.status === 'failed');
    if (sendable.length === 0) return;
    saveTemplate(eventId, { subject, body });
    setPhase('sending');
    setProgress({ done: 0, total: sendable.length });
    setOverrides(prev => {
      const next = { ...prev };
      for (const r of sendable) next[r.cert.email] = { status: 'sending' };
      return next;
    });

    const result = await sendCertificates(
      { subject, body, recipients: sendable.map(r => r.cert) },
      (done, total) => setProgress({ done, total }),
    );

    setOverrides(prev => {
      const next = { ...prev };
      for (const s of result.sent) next[s.email] = { status: 'sent' };
      for (const f of result.failed) next[f.email] = { status: 'failed', error: f.error };
      return next;
    });
    setSummary(result);
    setPhase('done');
  }

  const value: PanelContextValue = {
    rows, subject, body, setSubject, setBody, phase, progress, summary, send,
  };
  return (
    <PanelContext.Provider value={value}>
      <div className="apple-card apple-mt-md">{children}</div>
    </PanelContext.Provider>
  );
}

function TemplateEditor() {
  const { subject, body, setSubject, setBody, phase } = usePanel();
  const disabled = phase === 'sending';
  return (
    <div className="apple-form-group">
      <label className="apple-label">Subjek email</label>
      <input className="apple-input" value={subject} disabled={disabled}
        onChange={e => setSubject(e.target.value)} />
      <label className="apple-label apple-mt-sm">Isi email</label>
      <textarea className="apple-input" value={body} disabled={disabled} rows={8}
        onChange={e => setBody(e.target.value)} />
      <span className="apple-hint">
        Placeholder: {'{nama}'}, {'{nomor}'}, {'{acara}'}, {'{tanggal}'}, {'{peran}'}
      </span>
    </div>
  );
}

const STATUS_LABEL: Record<RowStatus, string> = {
  valid: 'Siap', 'invalid-email': 'Email tidak valid',
  sending: 'Mengirim…', sent: 'Terkirim', failed: 'Gagal',
};

function RecipientTable() {
  const { rows } = usePanel();
  return (
    <table className="apple-table apple-mt-sm">
      <thead><tr><th>Nama</th><th>Email</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.cert.email + r.cert.nama}>
            <td>{r.cert.nama}</td>
            <td>{r.cert.email || <span className="apple-fine">—</span>}</td>
            <td>{STATUS_LABEL[r.status]}{r.error ? ` · ${r.error}` : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SendButton() {
  const { rows, phase, progress, summary, send } = usePanel();
  const sendableCount = rows.filter(r => r.status === 'valid' || r.status === 'failed').length;
  return (
    <div className="apple-mt-md">
      {phase === 'sending' ? (
        <span className="apple-caption">Mengirim {progress.done} dari {progress.total}…</span>
      ) : (
        <button className="apple-btn apple-btn-primary apple-btn-lg"
          disabled={sendableCount === 0} onClick={send}>
          {phase === 'done' && summary && summary.failed.length > 0
            ? `Kirim Ulang yang Gagal (${sendableCount})`
            : `Kirim Email (${sendableCount})`}
        </button>
      )}
      {phase === 'done' && summary && (
        <div className="apple-caption apple-mt-sm">
          {summary.sent.length} terkirim · {summary.failed.length} gagal
        </div>
      )}
    </div>
  );
}

SendEmailPanel.TemplateEditor = TemplateEditor;
SendEmailPanel.RecipientTable = RecipientTable;
SendEmailPanel.SendButton = SendButton;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors in `SendEmailPanel.tsx` (caller wiring happens in Task 7).

> Commit bersama Task 7.

---

## Task 7: Integrasi ke `GenerateBulk`

**Files:**
- Modify: `src/components/generate/GenerateBulk.tsx`

Simpan PDF bytes per baris (bukan dibuang setelah ZIP), petakan kolom email, dan tampilkan `SendEmailPanel` setelah generate selesai.

- [ ] **Step 1: Add imports**

Di blok import `GenerateBulk.tsx`, tambah:

```typescript
import { buildCertNumber } from '../../lib/numberFormatter';
import { SendEmailPanel } from './SendEmailPanel';
import type { OutgoingCertificate } from '../../lib/emailSender';
```
*(`buildCertNumber` mungkin sudah ada — jangan duplikat.)* Hapus baris `import { buildZip, downloadBlob } from '../../lib/download';` HANYA jika masih dipakai (masih dipakai untuk ZIP — biarkan).

- [ ] **Step 2: Add state for email column + generated certificates**

Setelah deklarasi state yang ada (di dekat `const [done, setDone] = useState(0);`), tambah:

```typescript
  const [emailColumn, setEmailColumn] = useState('');
  const [certificates, setCertificates] = useState<OutgoingCertificate[]>([]);
```

- [ ] **Step 3: Pass email props to ColumnMapper**

Ganti pemanggilan `<ColumnMapper ... />` menjadi:

```tsx
          <ColumnMapper
            headers={headers}
            mapping={mapping}
            onChange={remap}
            emailColumn={emailColumn}
            onEmailChange={setEmailColumn}
          />
```

- [ ] **Step 4: Build certificates (with email) during generate**

Di dalam `generate()`, ubah loop Phase 1 agar mengumpulkan `OutgoingCertificate[]` paralel dengan `files`. Email diambil dari `raw` pada indeks baris yang sama (urutan `raw` → `rows` 1:1). Ganti loop Phase 1:

```typescript
      const outgoing: OutgoingCertificate[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (!mountedRef.current) return;
        const r = rows[i];
        if (!r.valid) continue;
        const nama = r.values.nama ?? '';
        setCurrentName(nama);
        const n = claimNextNumber(event.id);
        const values = resolveValues(event, r.values, n);
        const bytes = await renderCertificate(event, values);
        const numStr = String(n).padStart(event.nomorPadding, '0');
        const filename = `Sertifikat - ${numStr} - ${nama}.pdf`;
        const nomorRapi = buildCertNumber(event.polaNomor, n, event.nomorPadding, new Date(event.tanggal));
        files.push({ name: filename, bytes });
        outgoing.push({
          nama,
          email: (emailColumn ? raw[i]?.[emailColumn] ?? '' : '').trim(),
          filename,
          pdfBytes: bytes,
          // Placeholder template — selaras dengan hint di TemplateEditor.
          vars: {
            nama,
            nomor: nomorRapi,
            acara: event.nama,
            tanggal: event.tanggal,
            peran: r.values.peran ?? '',
          },
        });
        idx++;
        setDone(idx);
        setProgress(Math.round((idx / validCount) * 100));
      }
```

Hapus loop lama `for (const r of validRows) { ... }`. Lalu, sebelum `setPhase('idle')` di akhir blok sukses, simpan hasil:

```typescript
      if (mountedRef.current) setCertificates(outgoing);
```
*(Letakkan tepat sebelum `setPhase('idle'); setProgress(0); setDone(0);`.)*

- [ ] **Step 5: Render SendEmailPanel after the generate button**

Tepat setelah penutup `<div className="apple-mt-md"> … </div>` yang membungkus tombol Generate/progress (sebelum penutup `</>`), tambah:

```tsx
          {certificates.length > 0 && (
            <SendEmailPanel eventId={event.id} certificates={certificates}>
              <h4 className="apple-h4 apple-mb-sm">Kirim via Email</h4>
              <SendEmailPanel.TemplateEditor />
              <SendEmailPanel.RecipientTable />
              <SendEmailPanel.SendButton />
            </SendEmailPanel>
          )}
```

- [ ] **Step 6: Full type-check + build**

Run: `npm run build`
Expected: PASS — tidak ada error tipe. (ColumnMapper kini menerima props email; SendEmailPanel ter-wire.)

- [ ] **Step 7: Run the whole test suite**

Run: `npm run test`
Expected: PASS — semua test lama + test baru (Task 1–4) hijau.

- [ ] **Step 8: Lint**

Run: `npm run lint` *(jika skrip ada; jika tidak, lewati dan catat di handoff)*
Expected: 0 error. Laporkan jujur jika ada warning.

- [ ] **Step 9: Commit (Task 5 + 6 + 7 bersama)**

```bash
git add src/components/generate/ColumnMapper.tsx \
  src/components/generate/SendEmailPanel.tsx \
  src/components/generate/GenerateBulk.tsx
git commit -m "feat: UI kirim sertifikat via email di mode Massal"
```

---

## Task 8: Dokumentasi env & uji lokal

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add an "Email" section to README**

Tambahkan bagian berikut ke `README.md` (di bawah Instalasi):

```markdown
## Pengiriman Email (Resend + Vercel)

Fitur kirim sertifikat via email membutuhkan dua variabel lingkungan di Vercel
(Project Settings → Environment Variables) — JANGAN commit ke repo:

- `RESEND_API_KEY` — API key dari https://resend.com
- `RESEND_FROM` — alamat pengirim pada domain yang sudah diverifikasi di Resend,
  mis. `noreply@<domain-balai>.go.id`

### Uji lokal

Serverless function (`/api`) tidak berjalan di `vite dev`. Untuk uji end-to-end:

```bash
npm i -g vercel
vercel dev
```

Buat file `.env.local` (sudah di-ignore git) berisi `RESEND_API_KEY` dan
`RESEND_FROM` untuk pengujian lokal.
```

- [ ] **Step 2: Verify `.env*` is git-ignored**

Run: `git check-ignore .env.local`
Expected: mencetak `.env.local` (artinya di-ignore). Jika tidak, tambahkan `.env*` ke `.gitignore` dan commit perubahan `.gitignore` itu.

- [ ] **Step 3: Commit**

```bash
git add README.md .gitignore
git commit -m "docs: cara konfigurasi env Resend dan uji lokal pengiriman email"
```

---

## Self-Review (sudah dijalankan saat menulis plan)

**Spec coverage:**
- Arsitektur Resend+Vercel → Task 4. Sumber email dari kolom Excel/CSV → Task 5 + Task 7 Step 4. Preview+konfirmasi, status per-baris, ringkasan → Task 6. Template editable per-acara → Task 2 + Task 6. PDF dibuat di browser → Task 7 Step 4 (reuse `renderCertificate`). Batch 5–10 → Task 3 (`BATCH_SIZE=8`). Kirim ulang yang gagal → Task 6 (`SendButton`). Keamanan key di env, tidak menyentuh Supabase/auth → Task 4 + Task 8. localStorage ber-versi → Task 2. Testing intent → tiap task.
- Penyimpangan tercatat: `from` di-backend (lebih aman dari spec). Placeholder `{acara}/{tanggal}/{peran}` ditambahkan ke default template & hint (perluasan kecil dari spec yang sudah menyebut "variabel dari data").

**Placeholder scan:** tidak ada TBD/TODO; semua step berisi kode/-perintah konkret.

**Personalisasi (koreksi penting):** Interpolasi placeholder dilakukan PER penerima di `emailSender` (Task 3) memakai `OutgoingCertificate.vars` yang diisi di Task 7 Step 4. Subjek & badan dikirim sudah-jadi ke backend, jadi tiap orang menerima `{nama}`-nya sendiri — bukan literal placeholder.

**Type consistency:** `OutgoingCertificate` (kini dengan `vars`), `SendSummary`, `SendResult` didefinisikan di Task 3 dan dipakai konsisten di Task 4/6/7. `WireRecipient` (klien Task 3) ↔ backend (Task 4) cocok: `{ email, nama, filename, pdfBase64, subject, body }`. Payload fetch = `{ recipients }` (tanpa subject/body global). `loadTemplate/saveTemplate/interpolate/DEFAULT_TEMPLATE` konsisten Task 2 ↔ Task 3 ↔ Task 6.

**Catatan ketergantungan urutan:** Task 5 & 7 saling bergantung tipe props → commit bersama di akhir Task 7 (sudah dinyatakan eksplisit).
```
