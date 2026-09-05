-- GameOn 2.6 consolidated backend
-- One source of truth for expiry, player activity, organiser request counts and request decisions.

-- PUBLIC OPEN GAMES
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
  select g.id,g.venue,g.game_date,g.kickoff_time,g.format,g.players_needed,g.players_needed as spots_available,g.cost
  from public.games g
  where g.status='open'
    and g.players_needed>0
    and (g.game_date + g.kickoff_time) > timezone('Europe/London', now())
  order by g.game_date,g.kickoff_time;
$$;
revoke all on function public.get_open_games() from public;
grant execute on function public.get_open_games() to anon, authenticated;

-- PLAYER ACTIVITY
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
set search_path = public
as $$
  select jr.id,jr.status,jr.created_at,g.id,g.venue,g.game_date,g.kickoff_time,g.format,g.cost,
         case when (g.game_date + g.kickoff_time) <= timezone('Europe/London', now()) then 'expired' else g.status end,
         g.organiser_phone
  from public.join_requests jr
  join public.games g on g.id=jr.game_id
  where jr.player_id=auth.uid()
  order by jr.created_at desc;
$$;
revoke all on function public.get_my_play_activity() from public;
grant execute on function public.get_my_play_activity() to authenticated;

-- ORGANISER ACTIVE GAMES: count EXACTLY the same pending rows shown in Requests
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
  select g.id,g.venue,g.game_date,g.kickoff_time,g.format,g.players_needed,g.cost,
         count(*) filter (where jr.status='pending') as pending_count
  from public.games g
  left join public.join_requests jr on jr.game_id=g.id
  where g.organiser_id=auth.uid()
    and g.status='open'
    and g.players_needed>0
    and (g.game_date + g.kickoff_time) > timezone('Europe/London', now())
  group by g.id,g.venue,g.game_date,g.kickoff_time,g.format,g.players_needed,g.cost
  order by g.game_date,g.kickoff_time;
$$;
revoke all on function public.get_my_organiser_games() from public;
grant execute on function public.get_my_organiser_games() to authenticated;

-- ORGANISER PENDING REQUEST LIST
drop function if exists public.get_pending_requests_for_game_v2(uuid);
create function public.get_pending_requests_for_game_v2(p_game_id uuid)
returns table (
  request_id uuid,
  player_name text,
  player_phone text,
  player_level text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  if not exists(select 1 from public.games g where g.id=p_game_id and g.organiser_id=auth.uid()) then
    raise exception 'You do not own this game';
  end if;
  return query
  select jr.id,
         coalesce(nullif(trim(p.first_name),''),nullif(trim(jr.player_name),''),'GameOn player')::text,
         coalesce(nullif(trim(p.phone),''),jr.player_phone)::text,
         coalesce(nullif(trim(p.skill_level),''),nullif(trim(jr.player_level),''),'Not set')::text,
         jr.created_at
  from public.join_requests jr
  left join public.profiles p on p.id=jr.player_id
  where jr.game_id=p_game_id and jr.status='pending'
  order by jr.created_at;
end;
$$;
revoke all on function public.get_pending_requests_for_game_v2(uuid) from public;
grant execute on function public.get_pending_requests_for_game_v2(uuid) to authenticated;

-- PLAYER REQUEST
drop function if exists public.request_game_spot(uuid);
create function public.request_game_spot(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
  v_profile public.profiles%rowtype;
  v_pending integer;
begin
  if v_user is null then raise exception 'Please sign in first'; end if;
  select * into v_game from public.games where id=p_game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if v_game.status<>'open' then raise exception 'This game is no longer open'; end if;
  if (v_game.game_date + v_game.kickoff_time) <= timezone('Europe/London', now()) then raise exception 'This game has already started'; end if;
  if v_game.organiser_id=v_user then raise exception 'You cannot request a place in your own game'; end if;
  if v_game.players_needed<=0 then raise exception 'This game is already full'; end if;
  if exists(select 1 from public.join_requests where game_id=p_game_id and player_id=v_user) then
    raise exception 'You already requested a place in this game';
  end if;
  select count(*) into v_pending from public.join_requests where game_id=p_game_id and status='pending';
  if v_pending>=v_game.players_needed then raise exception 'All available places already have pending requests'; end if;
  select * into v_profile from public.profiles where id=v_user;
  if not found then raise exception 'Complete your GameOn profile first'; end if;
  if coalesce(trim(v_profile.first_name),'')='' then raise exception 'Add your first name to your profile'; end if;
  if coalesce(trim(v_profile.phone),'')='' then raise exception 'Add your WhatsApp/mobile number to your profile'; end if;
  insert into public.join_requests(game_id,player_id,player_name,player_phone,player_level,status,created_at)
  values(p_game_id,v_user,v_profile.first_name,v_profile.phone,coalesce(v_profile.skill_level,'Not set'),'pending',now());
end;
$$;
revoke all on function public.request_game_spot(uuid) from public;
grant execute on function public.request_game_spot(uuid) to authenticated;

-- ORGANISER ACCEPT / DECLINE
drop function if exists public.organiser_decide_request(uuid,text);
create function public.organiser_decide_request(p_request_id uuid,p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.join_requests%rowtype;
  v_game public.games%rowtype;
begin
  if p_decision not in ('accepted','declined') then raise exception 'Decision must be accepted or declined'; end if;
  select * into v_request from public.join_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_request.status<>'pending' then raise exception 'This request has already been decided'; end if;
  select * into v_game from public.games where id=v_request.game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if v_game.organiser_id<>auth.uid() then raise exception 'You do not own this game'; end if;
  if (v_game.game_date + v_game.kickoff_time) <= timezone('Europe/London', now()) then raise exception 'This game has already started'; end if;
  if p_decision='declined' then
    update public.join_requests set status='declined' where id=p_request_id;
    return;
  end if;
  if v_game.status<>'open' or v_game.players_needed<=0 then raise exception 'This game is already full or closed'; end if;
  update public.join_requests set status='accepted' where id=p_request_id;
  update public.games
     set players_needed=players_needed-1,
         status=case when players_needed-1<=0 then 'filled' else status end
   where id=v_game.id;
  if v_game.players_needed-1<=0 then
    update public.join_requests set status='declined'
    where game_id=v_game.id and status='pending';
  end if;
end;
$$;
revoke all on function public.organiser_decide_request(uuid,text) from public;
grant execute on function public.organiser_decide_request(uuid,text) to authenticated;

-- ORGANISER GAME STATE
drop function if exists public.organiser_set_game_state(uuid,text);
create function public.organiser_set_game_state(p_game_id uuid,p_state text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_state not in ('filled','cancelled','open') then raise exception 'Invalid game state'; end if;
  if not exists(select 1 from public.games where id=p_game_id and organiser_id=auth.uid()) then
    raise exception 'You do not own this game';
  end if;
  update public.games set status=p_state where id=p_game_id and organiser_id=auth.uid();
  if p_state='cancelled' then
    update public.join_requests set status='cancelled'
    where game_id=p_game_id and status in ('pending','accepted');
  elsif p_state='filled' then
    update public.join_requests set status='declined'
    where game_id=p_game_id and status='pending';
  end if;
end;
$$;
revoke all on function public.organiser_set_game_state(uuid,text) from public;
grant execute on function public.organiser_set_game_state(uuid,text) to authenticated;

notify pgrst, 'reload schema';
