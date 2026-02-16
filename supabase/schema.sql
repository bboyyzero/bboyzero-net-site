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

-- No public policies needed for this architecture.
-- Server uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS.
