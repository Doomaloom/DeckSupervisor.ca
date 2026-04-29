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
  session_year integer,
  start_date date,
  end_date date,
  location text,
  source_locations text[] not null default '{}',
  session_start_time24 text,
  session_end_time24 text,
  instructors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sessions
  add column if not exists session_year integer,
  add column if not exists source_locations text[] not null default '{}',
  add column if not exists session_start_time24 text,
  add column if not exists session_end_time24 text,
  alter column team_id drop not null,
  alter column location drop not null;

update sessions
set session_year = extract(year from start_date)::integer
where session_year is null
  and start_date is not null;

update sessions
set source_locations = array[location]
where coalesce(array_length(source_locations, 1), 0) = 0
  and location is not null
  and btrim(location) <> '';

create index if not exists sessions_team_id_idx on sessions(team_id);
create index if not exists sessions_created_by_idx on sessions(created_by);
create index if not exists sessions_team_season_year_idx on sessions(team_id, session_season, session_year);

alter table custom_rosters
  add column if not exists session_id uuid references sessions(id) on delete cascade;

alter table custom_rosters
  alter column session_id set not null;

create index if not exists custom_rosters_session_id_idx on custom_rosters(session_id);
create index if not exists custom_rosters_owner_session_day_idx on custom_rosters(owner_id, session_id, day);

create table if not exists attendance_sheets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete restrict,
  name text not null,
  base_template text,
  default_for_template text,
  sheet_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table attendance_sheets add column if not exists team_id uuid references teams(id) on delete cascade;
alter table attendance_sheets add column if not exists created_by uuid references profiles(id) on delete restrict;
alter table attendance_sheets add column if not exists name text;
alter table attendance_sheets add column if not exists base_template text;
alter table attendance_sheets add column if not exists default_for_template text;
alter table attendance_sheets add column if not exists sheet_data jsonb default '{}'::jsonb;
alter table attendance_sheets add column if not exists created_at timestamptz default now();
alter table attendance_sheets add column if not exists updated_at timestamptz default now();

update attendance_sheets
set sheet_data = '{}'::jsonb
where sheet_data is null;

update attendance_sheets
set created_at = now()
where created_at is null;

update attendance_sheets
set updated_at = now()
where updated_at is null;

alter table attendance_sheets
  alter column team_id set not null,
  alter column created_by set not null,
  alter column name set not null,
  alter column sheet_data set default '{}'::jsonb,
  alter column sheet_data set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists attendance_sheets_team_id_idx on attendance_sheets(team_id);
create index if not exists attendance_sheets_created_by_idx on attendance_sheets(created_by);
create index if not exists attendance_sheets_team_updated_idx on attendance_sheets(team_id, updated_at desc);
create unique index if not exists attendance_sheets_team_default_template_unique_idx
  on attendance_sheets(team_id, default_for_template)
  where default_for_template is not null;

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
  team_id uuid references teams(id) on delete cascade,
  session_season text,
  session_year integer,
  note_type text not null check (note_type in ('general', 'recognition', 'feedback', 'coaching', 'todo')),
  text text not null,
  employee_name text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table session_notes add column if not exists team_id uuid references teams(id) on delete cascade;
alter table session_notes add column if not exists session_season text;
alter table session_notes add column if not exists session_year integer;

create index if not exists session_notes_session_id_idx on session_notes(session_id);
create index if not exists session_notes_team_term_idx
  on session_notes(team_id, lower(session_season), session_year, created_at desc);

create table if not exists session_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  session_season text,
  session_year integer,
  title text not null default '',
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table session_reports add column if not exists team_id uuid references teams(id) on delete cascade;
alter table session_reports add column if not exists session_season text;
alter table session_reports add column if not exists session_year integer;

create index if not exists session_reports_session_id_idx on session_reports(session_id);
create index if not exists session_reports_created_by_idx on session_reports(created_by);
create index if not exists session_reports_session_updated_idx on session_reports(session_id, updated_at desc);
create index if not exists session_reports_team_term_idx
  on session_reports(team_id, lower(session_season), session_year, updated_at desc);

update session_notes n
set
  team_id = s.team_id,
  session_season = s.session_season,
  session_year = s.session_year
from sessions s
where n.session_id = s.id
  and (
    n.team_id is distinct from s.team_id
    or n.session_season is distinct from s.session_season
    or n.session_year is distinct from s.session_year
  );

update session_reports r
set
  team_id = s.team_id,
  session_season = s.session_season,
  session_year = s.session_year
from sessions s
where r.session_id = s.id
  and (
    r.team_id is distinct from s.team_id
    or r.session_season is distinct from s.session_season
    or r.session_year is distinct from s.session_year
  );

create or replace function populate_session_note_report_scope()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  session_row record;
begin
  select team_id, session_season, session_year
  into session_row
  from sessions
  where id = new.session_id;

  if not found then
    raise exception 'session % not found', new.session_id;
  end if;

  new.team_id := session_row.team_id;
  new.session_season := session_row.session_season;
  new.session_year := session_row.session_year;

  return new;
end;
$$;

drop trigger if exists populate_session_notes_scope on session_notes;
create trigger populate_session_notes_scope
before insert or update of session_id
on session_notes
for each row
execute function populate_session_note_report_scope();

drop trigger if exists populate_session_reports_scope on session_reports;
create trigger populate_session_reports_scope
before insert or update of session_id
on session_reports
for each row
execute function populate_session_note_report_scope();

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
