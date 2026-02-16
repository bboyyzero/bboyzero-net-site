create extension if not exists pgcrypto;

create table if not exists public.events (
  id text primary key,
  date date not null,
  city text not null,
  venue text not null,
  ticket_url text not null,
  image_url text,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.messages enable row level security;

-- Events: public read, authenticated users can insert/delete.
drop policy if exists "events_select_public" on public.events;
create policy "events_select_public"
  on public.events
  for select
  to anon, authenticated
  using (true);

drop policy if exists "events_insert_authenticated" on public.events;
create policy "events_insert_authenticated"
  on public.events
  for insert
  to authenticated
  with check (true);

drop policy if exists "events_delete_authenticated" on public.events;
create policy "events_delete_authenticated"
  on public.events
  for delete
  to authenticated
  using (true);

-- Messages: anyone can submit contact form entries.
drop policy if exists "messages_insert_public" on public.messages;
create policy "messages_insert_public"
  on public.messages
  for insert
  to anon, authenticated
  with check (true);

-- Optional: restrict reading messages to no one on client.
drop policy if exists "messages_select_none" on public.messages;
create policy "messages_select_none"
  on public.messages
  for select
  to anon, authenticated
  using (false);

-- Storage setup for static client uploads.
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "event_images_public_read" on storage.objects;
create policy "event_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'event-images');

drop policy if exists "event_images_auth_insert" on storage.objects;
create policy "event_images_auth_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'event-images');

drop policy if exists "event_images_auth_delete" on storage.objects;
create policy "event_images_auth_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'event-images');
