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
