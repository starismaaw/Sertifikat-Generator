-- ============================================================
-- Pakta Integritas: slug custom untuk link tanda tangan publik
-- Jalankan sekali di Supabase SQL Editor (setelah 0001_pakta_init.sql)
-- ============================================================

-- 1. Tambah kolom slug (nullable dulu, diisi lewat backfill di bawah)
alter table pakta_events add column if not exists slug text;

-- 2. Backfill: buat slug dari nama untuk semua baris yang sudah ada,
--    tambahkan akhiran -2, -3, dst kalau ada nama yang menghasilkan
--    slug dasar yang sama. Nama yang terlalu pendek (<3 karakter bersih)
--    jatuh ke 'acara'; nama yang terlalu panjang dipotong ke 55 karakter
--    (menyisakan ruang untuk akhiran -N) supaya tetap lolos constraint
--    format (3-60 karakter) yang ditambahkan di langkah 3.
with base as (
  select
    id,
    trim(both '-' from regexp_replace(lower(nama), '[^a-z0-9]+', '-', 'g')) as cleaned,
    created_at
  from pakta_events
  where slug is null
),
safe_base as (
  select
    id,
    created_at,
    case
      when length(cleaned) >= 3 then trim(trailing '-' from left(cleaned, 55))
      else 'acara'
    end as base_slug
  from base
),
numbered as (
  select
    id,
    case
      when row_number() over (partition by base_slug order by created_at) = 1
        then base_slug
      else base_slug || '-' || (row_number() over (partition by base_slug order by created_at))::text
    end as new_slug
  from safe_base
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
