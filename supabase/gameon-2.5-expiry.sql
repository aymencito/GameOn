-- GameOn 2.5 expiry consistency patch
-- Past games stay in history but disappear from active player/organiser discovery.

-- Public/open discovery: only genuinely open games today or later.
drop function if exists public.get_open_games();

create function public.get_open_games()
returns table (
  id uuid,
  venue text,
  game_date date,
  kickoff_time time,
  format text,
  players_needed integer,
  spots_available integer,
  cost numeric
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.venue,
    g.game_date,
    g.kickoff_time,
    g.format,
    g.players_needed,
    greatest(g.players_needed - coalesce((
      select count(*)::integer
      from public.join_requests jr
      where jr.game_id = g.id
        and jr.status = 'pending'
    ),0),0) as spots_available,
    g.cost
  from public.games g
  where g.status = 'open'
    and g.players_needed > 0
    and g.game_date >= current_date
  order by g.game_date, g.kickoff_time;
$$;

grant execute on function public.get_open_games() to anon, authenticated;

-- Organiser active view: only open games today or later.
drop function if exists public.get_my_organiser_games();

create function public.get_my_organiser_games()
returns table (
  id uuid,
  venue text,
  game_date date,
  kickoff_time time,
  format text,
  players_needed integer,
  cost numeric,
  pending_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.venue,
    g.game_date,
    g.kickoff_time,
    g.format,
    g.players_needed,
    g.cost,
    count(distinct jr.player_id) filter (where jr.status='pending') as pending_count
  from public.games g
  left join public.join_requests jr on jr.game_id = g.id
  where g.organiser_id = auth.uid()
    and g.status = 'open'
    and g.game_date >= current_date
  group by g.id,g.venue,g.game_date,g.kickoff_time,g.format,g.players_needed,g.cost
  order by g.game_date,g.kickoff_time;
$$;

grant execute on function public.get_my_organiser_games() to authenticated;

notify pgrst, 'reload schema';
