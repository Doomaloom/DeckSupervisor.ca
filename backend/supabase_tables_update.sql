alter table profiles
  add column if not exists location text;

alter table teams
  add column if not exists available_locations text[] not null default '{}';

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete restrict,
  session_day text not null,
  session_season text,
  start_date date,
  end_date date,
  location text,
  instructors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sessions
  alter column team_id drop not null,
  alter column location drop not null;

create index if not exists sessions_team_id_idx on sessions(team_id);
create index if not exists sessions_created_by_idx on sessions(created_by);

alter table custom_rosters
  add column if not exists session_id uuid references sessions(id) on delete cascade;

alter table custom_rosters
  alter column session_id set not null;

create index if not exists custom_rosters_session_id_idx on custom_rosters(session_id);
create index if not exists custom_rosters_owner_session_day_idx on custom_rosters(owner_id, session_id, day);

create table if not exists schematics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schematics_session_id_idx on schematics(session_id);

create table if not exists session_shares (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  share_date date not null,
  shared_by uuid not null references profiles(id) on delete cascade,
  shared_with uuid not null references profiles(id) on delete cascade,
  allow_roster_edits boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, shared_with, share_date)
);

create index if not exists session_shares_session_id_idx on session_shares(session_id);
create index if not exists session_shares_shared_with_idx on session_shares(shared_with);
create index if not exists session_shares_share_date_idx on session_shares(share_date);

create table if not exists session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  note_type text not null check (note_type in ('general', 'recognition', 'feedback', 'coaching', 'todo')),
  text text not null,
  employee_name text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists session_notes_session_id_idx on session_notes(session_id);

create table if not exists roster_level_edits (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  code text not null,
  level text not null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, code)
);

create index if not exists roster_level_edits_session_id_idx on roster_level_edits(session_id);

create table if not exists roster_student_level_edits (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  code text not null,
  student_name_hash text not null,
  level text not null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, code, student_name_hash)
);

create index if not exists roster_student_level_edits_session_id_idx on roster_student_level_edits(session_id);

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

with ranked as (
  select
    id,
    row_number() over (
      partition by session, day, instructor, created_by, coalesce(team_id::text, '__none__')
      order by updated_at desc, created_at desc, id desc
    ) as rn
  from report_cards
)
delete from report_cards using ranked
where report_cards.id = ranked.id
  and ranked.rn > 1;

alter table report_cards
  drop constraint if exists report_cards_session_day_instructor_team_id_key;

alter table report_cards
  drop constraint if exists report_cards_unique_scope;

create index if not exists report_cards_session_team_idx on report_cards(session, team_id);
create index if not exists report_cards_team_day_idx on report_cards(team_id, day);
create index if not exists report_cards_created_by_idx on report_cards(created_by);
create unique index if not exists report_cards_unique_with_team_idx
  on report_cards(session, day, instructor, team_id, created_by)
  where team_id is not null;
create unique index if not exists report_cards_unique_no_team_idx
  on report_cards(session, day, instructor, created_by)
  where team_id is null;
