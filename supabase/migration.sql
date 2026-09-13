create extension if not exists pgcrypto;
create table if not exists public.photobooths (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,
 image_url text not null,
 storage_path text not null unique,
 layout text not null,
 frame text not null,
 photo_count integer not null check (photo_count in (1,2,3,4,6,8,9)),
 custom_text text,
 event_name text,
 created_at timestamptz not null default now(),
 expires_at timestamptz
);
create index if not exists photobooths_session_idx on public.photobooths(session_id,created_at desc);
create index if not exists photobooths_expiry_idx on public.photobooths(expires_at);
alter table public.photobooths enable row level security;
revoke all on public.photobooths from anon, authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('photobooth-images','photobooth-images',false,10485760,array['image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/png','image/jpeg'];
