-- Recall Rush: players, verified runs, and leaderboard functions.
-- All writes go through the Next.js API (service role). Clients never touch these tables directly.

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  nickname text not null check (char_length(nickname) between 3 and 16),
  auth_user_id uuid references auth.users (id) on delete set null,
  country text,
  created_at timestamptz not null default now()
);

create unique index profiles_nickname_lower on public.profiles (lower(nickname));

create table public.runs (
  id uuid primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('endless', 'daily', 'challenge')),
  seed bigint not null,
  daily_date date,
  rounds integer not null check (rounds >= 0),
  points integer not null check (points >= 0),
  input_log jsonb not null,
  client_version text,
  created_at timestamptz not null default now()
);

-- Only the first daily run per player counts.
create unique index runs_one_daily on public.runs (profile_id, daily_date) where mode = 'daily';
create index runs_endless_best on public.runs (rounds desc, points desc) where mode = 'endless';
create index runs_daily_best on public.runs (daily_date, rounds desc, points desc) where mode = 'daily';
create index runs_created_at on public.runs (created_at);
create index runs_profile on public.runs (profile_id);

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
-- No policies on purpose: anon and authenticated roles get no direct access.

-- Best run per player on a board. board: 'all' | 'week' | 'daily'.
create or replace function public.board_runs(board text, day date)
returns table (run_id uuid, profile_id uuid, nickname text, rounds integer, points integer, created_at timestamptz)
language sql stable
set search_path = public
as $$
  select distinct on (r.profile_id)
    r.id, r.profile_id, p.nickname, r.rounds, r.points, r.created_at
  from runs r
  join profiles p on p.id = r.profile_id
  where case board
    when 'daily' then r.mode = 'daily' and r.daily_date = day
    when 'week' then r.mode = 'endless' and r.created_at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc'
    else r.mode = 'endless'
  end
  order by r.profile_id, r.rounds desc, r.points desc, r.created_at asc
$$;

create or replace function public.leaderboard(board text, day date, lim integer)
returns table (rank bigint, run_id uuid, nickname text, rounds integer, points integer, created_at timestamptz)
language sql stable
set search_path = public
as $$
  select rank() over (order by b.rounds desc, b.points desc) as rank,
         b.run_id, b.nickname, b.rounds, b.points, b.created_at
  from board_runs(board, day) b
  order by b.rounds desc, b.points desc, b.created_at asc
  limit least(greatest(lim, 1), 500)
$$;

-- Where a score lands among other players' bests on a board.
create or replace function public.standing(board text, day date, p_rounds integer, p_points integer, p_profile uuid)
returns table (rank bigint, total bigint)
language sql stable
set search_path = public
as $$
  select
    count(*) filter (where (b.rounds, b.points) > (p_rounds, p_points) and b.profile_id <> p_profile) + 1,
    greatest(count(*), 1)
  from board_runs(board, day) b
$$;

revoke all on function public.board_runs(text, date) from public, anon, authenticated;
revoke all on function public.leaderboard(text, date, integer) from public, anon, authenticated;
revoke all on function public.standing(text, date, integer, integer, uuid) from public, anon, authenticated;
