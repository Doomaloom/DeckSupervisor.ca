create extension if not exists "pgcrypto";

alter table if exists profiles
  add column if not exists location text;

alter table if exists teams
  add column if not exists available_locations text[];

alter table if exists teams
  alter column available_locations set default '{}'::text[];

update teams
set available_locations = '{}'::text[]
where available_locations is null;

alter table if exists teams
  alter column available_locations set not null;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete restrict,
  session_day text not null,
  session_season text,
  session_year integer,
  start_date date,
  end_date date,
  location text,
  session_start_time24 text,
  session_end_time24 text,
  instructors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sessions add column if not exists team_id uuid references teams(id) on delete cascade;
alter table sessions add column if not exists created_by uuid references profiles(id) on delete restrict;
alter table sessions add column if not exists session_day text;
alter table sessions add column if not exists session_season text;
alter table sessions add column if not exists session_year integer;
alter table sessions add column if not exists start_date date;
alter table sessions add column if not exists end_date date;
alter table sessions add column if not exists location text;
alter table sessions add column if not exists session_start_time24 text;
alter table sessions add column if not exists session_end_time24 text;
alter table sessions add column if not exists instructors jsonb default '[]'::jsonb;
alter table sessions add column if not exists created_at timestamptz default now();
alter table sessions add column if not exists updated_at timestamptz default now();

alter table sessions
  alter column team_id drop not null,
  alter column location drop not null;

update sessions
set instructors = '[]'::jsonb
where instructors is null;

update sessions
set created_at = now()
where created_at is null;

update sessions
set updated_at = now()
where updated_at is null;

update sessions
set session_year = extract(year from start_date)::integer
where session_year is null
  and start_date is not null;

create index if not exists sessions_team_id_idx on sessions(team_id);
create index if not exists sessions_created_by_idx on sessions(created_by);
create index if not exists sessions_team_season_year_idx on sessions(team_id, session_season, session_year);
create index if not exists sessions_day_location_idx on sessions(session_day, location);

alter table if exists custom_rosters
  add column if not exists session_id uuid references sessions(id) on delete cascade;

create index if not exists custom_rosters_session_id_idx on custom_rosters(session_id);
create index if not exists custom_rosters_owner_session_day_idx on custom_rosters(owner_id, session_id, day);

create table if not exists schematics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table schematics add column if not exists session_id uuid references sessions(id) on delete cascade;
alter table schematics add column if not exists data jsonb default '{}'::jsonb;
alter table schematics add column if not exists created_by uuid references profiles(id) on delete restrict;
alter table schematics add column if not exists created_at timestamptz default now();
alter table schematics add column if not exists updated_at timestamptz default now();

update schematics
set data = '{}'::jsonb
where data is null;

update schematics
set created_at = now()
where created_at is null;

update schematics
set updated_at = now()
where updated_at is null;

with ranked as (
  select
    id,
    row_number() over (
      partition by session_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from schematics
  where session_id is not null
)
delete from schematics using ranked
where schematics.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists schematics_session_id_unique_idx on schematics(session_id);
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

create table if not exists session_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  title text not null default '',
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table session_reports add column if not exists session_id uuid references sessions(id) on delete cascade;
alter table session_reports add column if not exists created_by uuid references profiles(id) on delete cascade;
alter table session_reports add column if not exists title text default '';
alter table session_reports add column if not exists report_data jsonb default '{}'::jsonb;
alter table session_reports add column if not exists created_at timestamptz default now();
alter table session_reports add column if not exists updated_at timestamptz default now();

update session_reports
set title = ''
where title is null;

update session_reports
set report_data = '{}'::jsonb
where report_data is null;

update session_reports
set created_at = now()
where created_at is null;

update session_reports
set updated_at = now()
where updated_at is null;

alter table session_reports
  alter column title set default '',
  alter column title set not null,
  alter column report_data set default '{}'::jsonb,
  alter column report_data set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists session_reports_session_id_idx on session_reports(session_id);
create index if not exists session_reports_created_by_idx on session_reports(created_by);
create index if not exists session_reports_session_updated_idx on session_reports(session_id, updated_at desc);

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

create table if not exists request_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  term text not null,
  location text not null,
  instructor text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, term, location)
);

alter table report_cards
  add column if not exists updated_at timestamptz default now();

update report_cards
set updated_at = now()
where updated_at is null;

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
create index if not exists request_assignments_term_location_idx on request_assignments(term, location);
create unique index if not exists report_cards_unique_with_team_idx
  on report_cards(session, day, instructor, team_id, created_by)
  where team_id is not null;
create unique index if not exists report_cards_unique_no_team_idx
  on report_cards(session, day, instructor, created_by)
  where team_id is null;
