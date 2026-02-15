create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  first_name text,
  last_name text,
  account_type text not null default 'part_time' check (account_type in ('part_time', 'full_time')),
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  invitee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  unique (team_id, invitee_id)
);

create table if not exists custom_rosters (
  id uuid primary key,
  owner_id uuid not null references profiles(id) on delete cascade,
  day text not null,
  service_name text not null,
  instructor text,
  source_codes text[] not null default '{}',
  student_hashes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists report_cards (
  id uuid primary key default gen_random_uuid(),
  session text not null,
  day text not null,
  instructor text not null,
  number_of_report_cards integer not null check (number_of_report_cards >= 0),
  team_id uuid references teams(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_cards_session_team_idx on report_cards(session, team_id);
create index if not exists report_cards_team_day_idx on report_cards(team_id, day);
create index if not exists report_cards_created_by_idx on report_cards(created_by);
create unique index if not exists report_cards_unique_with_team_idx
  on report_cards(session, day, instructor, team_id, created_by)
  where team_id is not null;
create unique index if not exists report_cards_unique_no_team_idx
  on report_cards(session, day, instructor, created_by)
  where team_id is null;
