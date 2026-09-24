-- ONEIN production security and privacy hardening
-- Apply after deploying gameon-2.6.js v4 / onein-launch-fixes.js v4.
--
-- Goals:
--   * profiles are visible and editable only by their owner;
--   * games and join_requests cannot be queried directly from the public API;
--   * public discovery exposes only the fields needed to advertise a game;
--   * phone numbers are returned only after an organiser accepts a request;
--   * all privileged actions verify auth.uid() server-side.

begin;

-- Remove inherited/default table privileges before adding the minimum needed
-- for the current client. Security-definer RPCs continue to run as their owner.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.games from anon, authenticated;
revoke all on table public.join_requests from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.join_requests enable row level security;

-- Replace any legacy policies so this file is the complete source of truth.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('profiles','games','join_requests')
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id=auth.uid());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id=auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id=auth.uid())
  with check (id=auth.uid());

grant select (id,first_name,phone,area,skill_level,updated_at)
  on public.profiles to authenticated;
grant insert (id,first_name,phone,area,skill_level,updated_at)
  on public.profiles to authenticated;
grant update (first_name,phone,area,skill_level,updated_at)
  on public.profiles to authenticated;

-- No direct games or join_requests grants are required. Every read/write is
-- mediated by an RPC that checks the signed-in user and the game owner.

-- Server-side game creation prevents organiser spoofing, rejects unreasonable
-- values and caps each account at 20 simultaneously active future shortages.
drop function if exists public.create_game_secure(text,date,time,text,integer,numeric,text);
create function public.create_game_secure(
  p_venue text,
  p_game_date date,
  p_kickoff_time time,
  p_format text,
  p_players_needed integer,
  p_cost numeric,
  p_level text default 'Any'
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
begin
  if v_user is null then raise exception 'Please sign in first'; end if;
  select * into v_profile from public.profiles where id=v_user;
  if not found
     or coalesce(trim(v_profile.first_name),'')=''
     or coalesce(trim(v_profile.phone),'')='' then
    raise exception 'Complete your ONEIN profile first';
  end if;
  if length(trim(coalesce(p_venue,''))) not between 2 and 160 then
    raise exception 'Enter a valid venue';
  end if;
  if p_game_date is null or p_kickoff_time is null
     or (p_game_date+p_kickoff_time)<=timezone('Europe/London',now()) then
    raise exception 'Kickoff must be in the future';
  end if;
  if p_game_date>current_date+90 then raise exception 'Games can be posted up to 90 days ahead'; end if;
  if p_format not in ('5-a-side','7-a-side','11-a-side') then raise exception 'Invalid game format'; end if;
  if p_players_needed not between 1 and 20 then raise exception 'Players needed must be between 1 and 20'; end if;
  if p_cost<0 or p_cost>100 then raise exception 'Player fee must be between £0 and £100'; end if;
  if (select count(*) from public.games g
      where g.organiser_id=v_user and g.status='open'
        and (g.game_date+g.kickoff_time)>timezone('Europe/London',now()))>=20 then
    raise exception 'You already have too many active games';
  end if;

  insert into public.games(
    organiser_id,organiser_name,organiser_phone,venue,game_date,kickoff_time,
    format,players_needed,cost,level,status
  ) values (
    v_user,v_profile.first_name,v_profile.phone,trim(p_venue),p_game_date,p_kickoff_time,
    p_format,p_players_needed,p_cost,coalesce(nullif(trim(p_level),''),'Any'),'open'
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_game_secure(text,date,time,text,integer,numeric,text) from public;
grant execute on function public.create_game_secure(text,date,time,text,integer,numeric,text) to authenticated;

-- Public discovery intentionally omits organiser identifiers and phone data.
create or replace function public.get_open_games()
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
set search_path=public
as $$
  select
    g.id,g.venue,g.game_date,g.kickoff_time,g.format,g.players_needed,
    greatest(g.players_needed-coalesce((
      select count(*)::integer
      from public.join_requests jr
      where jr.game_id=g.id and jr.status='pending'
    ),0),0),
    g.cost
  from public.games g
  where g.status='open'
    and g.players_needed>0
    and (g.game_date+g.kickoff_time)>timezone('Europe/London',now())
  order by g.game_date,g.kickoff_time;
$$;
revoke all on function public.get_open_games() from public;
grant execute on function public.get_open_games() to anon,authenticated;

-- A player sees the organiser phone only after acceptance. Pending, declined,
-- cancelled and expired records do not disclose it through this RPC.
drop function if exists public.get_my_play_activity();
create function public.get_my_play_activity()
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
set search_path=public
as $$
  select
    jr.id,jr.status,jr.created_at,g.id,g.venue,g.game_date,g.kickoff_time,
    g.format,g.cost,
    case
      when (g.game_date+g.kickoff_time)<=timezone('Europe/London',now()) then 'expired'
      else g.status
    end,
    case
      when jr.status='accepted'
       and g.status<>'cancelled'
       and (g.game_date+g.kickoff_time)>timezone('Europe/London',now())
      then g.organiser_phone
      else null
    end
  from public.join_requests jr
  join public.games g on g.id=jr.game_id
  where jr.player_id=auth.uid()
  order by jr.created_at desc;
$$;
revoke all on function public.get_my_play_activity() from public;
grant execute on function public.get_my_play_activity() to authenticated;

-- Pending-request cards never contain the player's phone number.
drop function if exists public.get_pending_requests_for_game_v3(uuid);
create function public.get_pending_requests_for_game_v3(p_game_id uuid)
returns table (
  request_id uuid,
  player_name text,
  player_level text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  if not exists(
    select 1 from public.games g
    where g.id=p_game_id and g.organiser_id=auth.uid()
  ) then raise exception 'You do not own this game'; end if;

  return query
  select
    jr.id,
    coalesce(nullif(trim(p.first_name),''),nullif(trim(jr.player_name),''),'ONEIN player')::text,
    coalesce(nullif(trim(p.skill_level),''),nullif(trim(jr.player_level),''),'Not set')::text,
    jr.created_at
  from public.join_requests jr
  left join public.profiles p on p.id=jr.player_id
  where jr.game_id=p_game_id and jr.status='pending'
  order by jr.created_at;
end;
$$;
revoke all on function public.get_pending_requests_for_game_v3(uuid) from public;
grant execute on function public.get_pending_requests_for_game_v3(uuid) to authenticated;

-- Acceptance returns the contact only after the request is successfully
-- accepted. The phone is never included in the pending-request list.
drop function if exists public.organiser_accept_request_secure(uuid);
create function public.organiser_accept_request_secure(p_request_id uuid)
returns table (player_name text,player_phone text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_request public.join_requests%rowtype;
  v_game public.games%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;

  select * into v_request
  from public.join_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'Request not found'; end if;
  if v_request.status<>'pending' then raise exception 'This request has already been decided'; end if;

  select * into v_game
  from public.games
  where id=v_request.game_id
  for update;
  if not found then raise exception 'Game not found'; end if;
  if v_game.organiser_id<>auth.uid() then raise exception 'You do not own this game'; end if;
  if (v_game.game_date+v_game.kickoff_time)<=timezone('Europe/London',now()) then
    raise exception 'This game has already started';
  end if;
  if v_game.status<>'open' or v_game.players_needed<=0 then
    raise exception 'This game is already full or closed';
  end if;

  update public.join_requests set status='accepted' where id=p_request_id;
  update public.games
  set players_needed=players_needed-1,
      status=case when players_needed-1<=0 then 'filled' else status end
  where id=v_game.id;

  if v_game.players_needed-1<=0 then
    update public.join_requests
    set status='declined'
    where game_id=v_game.id and status='pending';
  end if;

  return query
  select
    coalesce(nullif(trim(p.first_name),''),nullif(trim(v_request.player_name),''),'ONEIN player')::text,
    coalesce(nullif(trim(p.phone),''),v_request.player_phone)::text
  from public.profiles p
  where p.id=v_request.player_id;

  if not found then
    return query select
      coalesce(nullif(trim(v_request.player_name),''),'ONEIN player')::text,
      nullif(trim(v_request.player_phone),'')::text;
  end if;
end;
$$;
revoke all on function public.organiser_accept_request_secure(uuid) from public;
grant execute on function public.organiser_accept_request_secure(uuid) to authenticated;

-- Once the v4 frontend is live, keep the legacy endpoint compatible but stop
-- exposing phone numbers before acceptance.
drop function if exists public.get_pending_requests_for_game_v2(uuid);
create function public.get_pending_requests_for_game_v2(p_game_id uuid)
returns table (
  request_id uuid,
  player_name text,
  player_phone text,
  player_level text,
  created_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select r.request_id,r.player_name,null::text,r.player_level,r.created_at
  from public.get_pending_requests_for_game_v3(p_game_id) r;
$$;
revoke all on function public.get_pending_requests_for_game_v2(uuid) from public;
grant execute on function public.get_pending_requests_for_game_v2(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
