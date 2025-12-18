-- Supabase schema for Absensi Sinergi
-- Run this in Supabase SQL editor

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_at timestamptz,
  end_at timestamptz,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  participant_code text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, participant_code)
);

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  table_number int not null,
  seat_number int not null,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  unique (event_id, table_number, seat_number)
);

create table if not exists public.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, participant_id),
  unique (event_id, seat_id)
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  source text not null default 'qr',
  notes text
);

create table if not exists public.admins (
  id uuid primary key, -- maps to auth.users.id
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_participants_event on public.participants(event_id);
create index if not exists idx_seats_event on public.seats(event_id);
create index if not exists idx_seat_assignments_event on public.seat_assignments(event_id);
create index if not exists idx_attendance_event_participant_time on public.attendance_logs(event_id, participant_id, scanned_at desc);

-- RLS policies (basic). You can tighten as needed.
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.seats enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.admins enable row level security;

-- For now, block all by default
drop policy if exists "no anon select events" on public.events;
create policy "no anon select events" on public.events for select to anon using (false);
drop policy if exists "no anon select participants" on public.participants;
create policy "no anon select participants" on public.participants for select to anon using (false);
drop policy if exists "no anon select seats" on public.seats;
create policy "no anon select seats" on public.seats for select to anon using (false);
drop policy if exists "no anon select seat_assignments" on public.seat_assignments;
create policy "no anon select seat_assignments" on public.seat_assignments for select to anon using (false);
drop policy if exists "no anon select attendance_logs" on public.attendance_logs;
create policy "no anon select attendance_logs" on public.attendance_logs for select to anon using (false);

-- Admins (authenticated) can read. You can add a check to join admins table
drop policy if exists "auth can select events" on public.events;
create policy "auth can select events" on public.events for select to authenticated using (true);
drop policy if exists "auth can select participants" on public.participants;
create policy "auth can select participants" on public.participants for select to authenticated using (true);
drop policy if exists "auth can select seats" on public.seats;
create policy "auth can select seats" on public.seats for select to authenticated using (true);
drop policy if exists "auth can select seat_assignments" on public.seat_assignments;
create policy "auth can select seat_assignments" on public.seat_assignments for select to authenticated using (true);
drop policy if exists "auth can select attendance_logs" on public.attendance_logs;
create policy "auth can select attendance_logs" on public.attendance_logs for select to authenticated using (true);

-- Writes via service role (from Next.js API) bypass RLS, so we don't need public policies for inserts.
