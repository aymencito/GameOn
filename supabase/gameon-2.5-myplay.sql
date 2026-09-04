-- GameOn 2.5 My Play activity patch
-- Gives each signed-in player a secure view of their own requests + game details.

create or replace function public.get_my_play_activity()
returns table (
  request_id uuid,
  request_status text,
  request_created_at timestamptz,
  game_id uuid,
  venue text,
  game_date date,
  kickoff_time time,
  format text,
  cost numeric,
  game_status text,
  organiser_phone text
)
language sql
security definer
set search_path = public
as $$
  select
    jr.id,
    jr.status,
    jr.created_at,
    g.id,
    g.venue,
    g.game_date,
    g.kickoff_time,
    g.format,
    g.cost,
    g.status,
    g.organiser_phone
  from public.join_requests jr
  join public.games g on g.id = jr.game_id
  where jr.player_id = auth.uid()
  order by jr.created_at desc;
$$;

revoke all on function public.get_my_play_activity() from public;
grant execute on function public.get_my_play_activity() to authenticated;

notify pgrst, 'reload schema';
