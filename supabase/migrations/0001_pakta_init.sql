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
