-- Certificate picture library (Certificate Studio > Uploads): logos, backgrounds and graphics kept in storage instead of inside the design.
--
-- Run AFTER 0048_certificate_signatures.sql (it reuses that file's helper public.certificate_signature_chair). Safe to run twice.
--
-- What it creates
--   * table  public.certificate_assets : one row per picture of a conference (name, type, size)
--   * bucket certificate-assets        : the pictures (PNG / JPG / WebP, 2 MB at most). The object name is the asset's id.
--   * a limit of 200 pictures per conference (a library for its certificates, not a file store)
--
-- Who may do what
--   * the library (rows) and uploading / replacing / deleting pictures: only the conference's chairs and track chairs
--   * reading a picture: anyone with its link. The link holds a random id nobody can list, and the picture is printed on every certificate that
--     uses it (people see it in My Certificates). The list of pictures stays chairs only.
--
-- A design refers to a picture as  asset:<id>  (the own backend's library uses the same scheme, so keep these ids when moving over).
-- Designs saved before this existed keep their picture inside the design (a data URL); the designer moves it into this library the next time
-- the design is opened.

create table if not exists public.certificate_assets (
  id            uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  storage_path  text not null,
  content_type  text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes    integer not null check (size_bytes between 1 and 2097152),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists certificate_assets_conference_idx on public.certificate_assets (conference_id);

create or replace function public.certificate_assets_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.certificate_assets where conference_id = new.conference_id) >= 200 then
      raise exception 'This conference already has 200 pictures. Delete some you no longer use first.';
    end if;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;
drop trigger if exists certificate_assets_before_write on public.certificate_assets;
create trigger certificate_assets_before_write before insert or update on public.certificate_assets
  for each row execute function public.certificate_assets_before_write();

alter table public.certificate_assets enable row level security;

drop policy if exists certificate_assets_select on public.certificate_assets;
drop policy if exists certificate_assets_insert on public.certificate_assets;
drop policy if exists certificate_assets_update on public.certificate_assets;
drop policy if exists certificate_assets_delete on public.certificate_assets;

create policy certificate_assets_select on public.certificate_assets
  for select to authenticated using (public.certificate_signature_chair(conference_id));
create policy certificate_assets_insert on public.certificate_assets
  for insert to authenticated with check (public.certificate_signature_chair(conference_id));
create policy certificate_assets_update on public.certificate_assets
  for update to authenticated using (public.certificate_signature_chair(conference_id)) with check (public.certificate_signature_chair(conference_id));
create policy certificate_assets_delete on public.certificate_assets
  for delete to authenticated using (public.certificate_signature_chair(conference_id));

grant select, insert, update, delete on public.certificate_assets to authenticated;

-- ---------------------------------------------------------------- the pictures
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-assets', 'certificate-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists certificate_asset_files_select on storage.objects;
drop policy if exists certificate_asset_files_insert on storage.objects;
drop policy if exists certificate_asset_files_update on storage.objects;
drop policy if exists certificate_asset_files_delete on storage.objects;

-- A picture may be written only under the id of an asset row the caller is a chair for (the row is created first).
create policy certificate_asset_files_select on storage.objects
  for select to authenticated using (
    bucket_id = 'certificate-assets'
    and exists (select 1 from public.certificate_assets a where a.id::text = storage.objects.name and public.certificate_signature_chair(a.conference_id))
  );
create policy certificate_asset_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'certificate-assets'
    and exists (select 1 from public.certificate_assets a where a.id::text = storage.objects.name and public.certificate_signature_chair(a.conference_id))
  );
create policy certificate_asset_files_update on storage.objects
  for update to authenticated using (
    bucket_id = 'certificate-assets'
    and exists (select 1 from public.certificate_assets a where a.id::text = storage.objects.name and public.certificate_signature_chair(a.conference_id))
  ) with check (
    bucket_id = 'certificate-assets'
    and exists (select 1 from public.certificate_assets a where a.id::text = storage.objects.name and public.certificate_signature_chair(a.conference_id))
  );
create policy certificate_asset_files_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'certificate-assets'
    and exists (select 1 from public.certificate_assets a where a.id::text = storage.objects.name and public.certificate_signature_chair(a.conference_id))
  );
