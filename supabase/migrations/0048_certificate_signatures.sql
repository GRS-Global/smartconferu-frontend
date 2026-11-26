-- Certificate signature library (Certificate Studio > Signatures).
--
-- Run AFTER 0046_certificates.sql and 0047_my_certificates.sql, in the Supabase SQL editor. Safe to run twice.
--
-- What it creates
--   * table  public.certificate_signatures : one row per signatory of a conference (name, designation, institution, which picture, is it the default)
--   * bucket certificate-signatures        : the pictures (PNG / JPG / WebP, 1 MB at most). The object name is the signature's id.
--   * function public.set_default_certificate_signature(id) : makes one signature the conference's default (one default per conference)
--
-- Who may do what
--   * the library (rows) and uploading / replacing / deleting pictures: only the conference's chairs and track chairs (active members)
--   * reading a picture: anyone with its link. The link holds a random id nobody can list, and the picture is printed on every certificate
--     that uses it (people see it in My Certificates), so it is as visible as the certificate. The list of signatories stays chairs only.
--
-- Moving to the own backend later: keep these ids. A design refers to a picture as  sig:<id>  and the backend library uses the same scheme.

-- ---------------------------------------------------------------- helper: is the caller a chair of this conference?
create or replace function public.certificate_signature_chair(p_conference uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conference_members m
    where m.conference_id = p_conference
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('chair', 'track_chair')
  );
$$;
revoke all on function public.certificate_signature_chair(uuid) from public;
grant execute on function public.certificate_signature_chair(uuid) to authenticated;

-- ---------------------------------------------------------------- table
create table if not exists public.certificate_signatures (
  id            uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 200),
  designation   text not null default '' check (char_length(designation) <= 200),
  institution   text not null default '' check (char_length(institution) <= 300),
  -- the object name in the bucket (= id); kept as a column so the picture can move later without touching designs
  storage_path  text not null,
  content_type  text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes    integer not null check (size_bytes between 1 and 1048576),
  is_default    boolean not null default false,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists certificate_signatures_conference_idx on public.certificate_signatures (conference_id);
-- at most one default signature per conference
create unique index if not exists certificate_signatures_one_default on public.certificate_signatures (conference_id) where is_default;

create or replace function public.certificate_signatures_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists certificate_signatures_touch on public.certificate_signatures;
create trigger certificate_signatures_touch before update on public.certificate_signatures
  for each row execute function public.certificate_signatures_touch();

alter table public.certificate_signatures enable row level security;

drop policy if exists certificate_signatures_select on public.certificate_signatures;
drop policy if exists certificate_signatures_insert on public.certificate_signatures;
drop policy if exists certificate_signatures_update on public.certificate_signatures;
drop policy if exists certificate_signatures_delete on public.certificate_signatures;

create policy certificate_signatures_select on public.certificate_signatures
  for select to authenticated using (public.certificate_signature_chair(conference_id));
create policy certificate_signatures_insert on public.certificate_signatures
  for insert to authenticated with check (public.certificate_signature_chair(conference_id));
create policy certificate_signatures_update on public.certificate_signatures
  for update to authenticated using (public.certificate_signature_chair(conference_id)) with check (public.certificate_signature_chair(conference_id));
create policy certificate_signatures_delete on public.certificate_signatures
  for delete to authenticated using (public.certificate_signature_chair(conference_id));

grant select, insert, update, delete on public.certificate_signatures to authenticated;

-- ---------------------------------------------------------------- default signature (one statement pair, under the caller's own RLS)
create or replace function public.set_default_certificate_signature(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_conference uuid;
begin
  select conference_id into v_conference from public.certificate_signatures where id = p_id;
  if v_conference is null then
    raise exception 'That signature was not found.';
  end if;
  update public.certificate_signatures set is_default = false where conference_id = v_conference and id <> p_id and is_default;
  update public.certificate_signatures set is_default = true where id = p_id;
end;
$$;
revoke all on function public.set_default_certificate_signature(uuid) from public;
grant execute on function public.set_default_certificate_signature(uuid) to authenticated;

-- ---------------------------------------------------------------- the pictures
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-signatures', 'certificate-signatures', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists certificate_signature_files_select on storage.objects;
drop policy if exists certificate_signature_files_insert on storage.objects;
drop policy if exists certificate_signature_files_update on storage.objects;
drop policy if exists certificate_signature_files_delete on storage.objects;

-- A picture may be written only under the id of a signature row the caller is a chair for (the row is created first).
create policy certificate_signature_files_select on storage.objects
  for select to authenticated using (
    bucket_id = 'certificate-signatures'
    and exists (select 1 from public.certificate_signatures s where s.id::text = storage.objects.name and public.certificate_signature_chair(s.conference_id))
  );
create policy certificate_signature_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'certificate-signatures'
    and exists (select 1 from public.certificate_signatures s where s.id::text = storage.objects.name and public.certificate_signature_chair(s.conference_id))
  );
create policy certificate_signature_files_update on storage.objects
  for update to authenticated using (
    bucket_id = 'certificate-signatures'
    and exists (select 1 from public.certificate_signatures s where s.id::text = storage.objects.name and public.certificate_signature_chair(s.conference_id))
  ) with check (
    bucket_id = 'certificate-signatures'
    and exists (select 1 from public.certificate_signatures s where s.id::text = storage.objects.name and public.certificate_signature_chair(s.conference_id))
  );
create policy certificate_signature_files_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'certificate-signatures'
    and exists (select 1 from public.certificate_signatures s where s.id::text = storage.objects.name and public.certificate_signature_chair(s.conference_id))
  );
