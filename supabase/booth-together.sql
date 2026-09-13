-- Run AFTER migration.sql. This migration adds tables; solo photobooths are unchanged.
-- Run in the Supabase SQL Editor as the database owner. Re-runnable.
begin;
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z2-9]{6}$'),
  host_participant_id uuid not null,
  invite_token_hash text not null,
  status text not null default 'lobby' check (status in ('waiting','lobby','ready','countdown','capturing','uploading','reviewing','round_complete','generating','completed','ended')),
  photo_count integer not null check (photo_count in (1,2,3,4,6,8,9)),
  current_round integer not null default 0,
  layout text not null,
  frame text not null,
  max_participants integer not null default 4 check (max_participants between 2 and 4),
  countdown_seconds integer not null default 3 check (countdown_seconds between 3 and 10),
  auto_continue boolean not null default true,
  capture_id uuid,
  capture_at timestamptz,
  roster uuid[] not null default '{}',
  result_id uuid references public.photobooths(id) on delete set null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);
create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  token_hash text not null,
  host_token_hash text not null,
  is_host boolean not null default false,
  status text not null default 'connected' check (status in ('joining','connected','not_ready','ready','countdown','capturing','uploading','reviewing','accepted','retaking','disconnected','left','removed')),
  ready boolean not null default false,
  camera_enabled boolean not null default false,
  capture_id uuid,
  capture_at timestamptz,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(room_id, participant_id)
);
create table if not exists public.room_photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid not null,
  round integer not null check (round between 1 and 9),
  capture_id uuid not null,
  image_url text not null,
  storage_path text not null unique,
  approved boolean not null default false,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(room_id, participant_id, round),
  foreign key(room_id, participant_id) references public.room_participants(room_id,participant_id) on delete cascade
);
create index if not exists rooms_expiry_idx on public.rooms(expires_at);
create index if not exists rooms_result_id_idx on public.rooms(result_id);
create index if not exists room_participants_room_idx on public.room_participants(room_id,last_seen_at);
create index if not exists room_photos_room_idx on public.room_photos(room_id,round);
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_photos enable row level security;
revoke all on public.rooms,public.room_participants,public.room_photos from anon,authenticated;
grant all on public.rooms,public.room_participants,public.room_photos to service_role;

-- PRIVATE realtime channels are joined only by Express with service_role.
-- No anon/authenticated policies on realtime.messages are added intentionally.
-- No public table publication is needed: state is broadcast after committed RPCs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('room-photos','room-photos',false,10485760,array['image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/png','image/jpeg'];

create or replace function public.booth_room_snapshot(p_room uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'room', to_jsonb(r) - 'invite_token_hash',
    'participants', coalesce((select jsonb_agg(to_jsonb(p) - 'token_hash' - 'host_token_hash' order by p.joined_at,p.participant_id)
      from public.room_participants p where p.room_id=r.id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(to_jsonb(ph) - 'storage_path' order by ph.round,ph.participant_id)
      from public.room_photos ph where ph.room_id=r.id and ph.participant_id=any(r.roster)), '[]'::jsonb)
  ) from public.rooms r where r.id=p_room;
$$;

create or replace function public.booth_room_create(p_code text,p_actor uuid,p_token_hash text,p_host_hash text,p_invite_hash text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room uuid;
begin
  insert into public.rooms(room_code,host_participant_id,invite_token_hash,photo_count,layout,frame,max_participants,countdown_seconds,auto_continue)
  values(p_code,p_actor,p_invite_hash,(p_data->>'photoCount')::integer,p_data->>'layout',p_data->>'frame',
    (p_data->>'maxParticipants')::integer,(p_data->>'countdownSeconds')::integer,(p_data->>'autoContinue')::boolean) returning id into v_room;
  insert into public.room_participants(room_id,participant_id,display_name,token_hash,host_token_hash,is_host)
  values(v_room,p_actor,p_data->>'displayName',p_token_hash,p_host_hash,true);
  return public.booth_room_snapshot(v_room);
end;
$$;

-- ALL mutations lock the same room row, including capacity, approvals and host transfer.
-- The functions are executable ONLY by the server service role.
create or replace function public.booth_room_command(p_code text,p_actor uuid,p_token_hash text,p_host_hash text,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms%rowtype;
  actor public.room_participants%rowtype;
  target uuid;
  attempt uuid;
  scheduled timestamptz;
  complete_round boolean;
  host_action boolean;
  active_count integer;
  supplied_invite text;
begin
  select * into r from public.rooms where room_code=p_code for update;
  if not found then raise exception using message='Room not found.',errcode='P0002'; end if;
  if r.expires_at <= now() then raise exception using message='This room has expired.',errcode='P0010'; end if;
  if p_action='join' then
    if r.status not in ('waiting','lobby','ready') then raise exception using message='This room has already started. Reconnect using your original browser.',errcode='P0001'; end if;
    supplied_invite := p_data->>'inviteHash';
    if supplied_invite is not null and supplied_invite<>r.invite_token_hash then
      raise exception using message='This invite link is invalid.',errcode='P0003';
    end if;
    if exists(select 1 from public.room_participants where room_id=r.id and participant_id=p_actor) then
      raise exception using message='This browser already joined. Restore the saved room session or use a new tab.',errcode='P0001';
    end if;
    select count(*) into active_count from public.room_participants where room_id=r.id and status not in ('left','removed');
    if active_count >= r.max_participants then raise exception using message='This room is full.',errcode='P0001'; end if;
    insert into public.room_participants(room_id,participant_id,display_name,token_hash,host_token_hash)
    values(r.id,p_actor,p_data->>'displayName',p_token_hash,p_data->>'hostHash');
    update public.rooms set version=version+1 where id=r.id;
    return public.booth_room_snapshot(r.id);
  end if;

  select * into actor from public.room_participants where room_id=r.id and participant_id=p_actor and token_hash=p_token_hash;
  if not found or actor.status='removed' then raise exception using message='Your room session is invalid. Please join again.',errcode='P0003'; end if;
  if p_action='snapshot' then return public.booth_room_snapshot(r.id); end if;
  if r.status='ended' and p_action not in ('leave') then raise exception using message='The host ended this room.',errcode='P0010'; end if;
  if actor.status='left' and p_action not in ('heartbeat','leave') then raise exception using message='Reconnect before using room controls.',errcode='P0003'; end if;
  host_action := p_action in ('configure','start','next','remove','end','retry-generation','store-result') or (p_action='retake' and coalesce(p_data->>'all','false')='true');
  if host_action and (r.host_participant_id<>p_actor or p_host_hash is null or p_host_hash<>actor.host_token_hash) then
    raise exception using message='Only the current host can use this control.',errcode='P0003';
  end if;

  if p_action='heartbeat' then
    update public.room_participants set last_seen_at=now(),camera_enabled=coalesce((p_data->>'cameraEnabled')::boolean,camera_enabled),
      status=case when status in ('left','disconnected') then
        case when r.current_round=0 then 'not_ready' when exists(select 1 from public.room_photos ph where ph.room_id=r.id and ph.participant_id=p_actor and ph.round=r.current_round and ph.approved) then 'accepted'
        when exists(select 1 from public.room_photos ph where ph.room_id=r.id and ph.participant_id=p_actor and ph.round=r.current_round) then 'reviewing'
        when capture_at > now() then 'countdown' else 'uploading' end else status end
      where room_id=r.id and participant_id=p_actor;
    update public.room_participants set ready=false where room_id=r.id and participant_id=p_actor and not camera_enabled;
  elsif p_action='disconnect' then
    update public.room_participants set status='disconnected',ready=false,last_seen_at=now() where room_id=r.id and participant_id=p_actor and status not in ('left','removed');
  elsif p_action='ready' then
    if r.current_round<>0 then raise exception using message='This session has already started.',errcode='P0001'; end if;
    if (p_data->>'ready')::boolean and not (p_data->>'cameraEnabled')::boolean then raise exception using message='Turn on your camera before getting ready.',errcode='P0001'; end if;
    update public.room_participants set ready=(p_data->>'ready')::boolean,camera_enabled=(p_data->>'cameraEnabled')::boolean,
      status=case when (p_data->>'ready')::boolean then 'ready' else 'not_ready' end,last_seen_at=now() where room_id=r.id and participant_id=p_actor;
  elsif p_action='configure' then
    if r.current_round<>0 then raise exception using message='Settings are locked after the session starts.',errcode='P0001'; end if;
    select count(*) into active_count from public.room_participants where room_id=r.id and status not in ('left','removed');
    if (p_data->>'maxParticipants')::integer < active_count then raise exception using message='The room already has more people than this capacity.',errcode='P0001'; end if;
    update public.rooms set photo_count=(p_data->>'photoCount')::integer,layout=p_data->>'layout',frame=p_data->>'frame',
      max_participants=(p_data->>'maxParticipants')::integer,countdown_seconds=(p_data->>'countdownSeconds')::integer,
      auto_continue=(p_data->>'autoContinue')::boolean where id=r.id;
    update public.room_participants set ready=false,status='not_ready' where room_id=r.id and status not in ('left','removed');
  elsif p_action='start' then
    if r.current_round<>0 then raise exception using message='The booth has already started.',errcode='P0001'; end if;
    select array_agg(participant_id order by joined_at,participant_id),count(*) into r.roster,active_count
      from public.room_participants where room_id=r.id and status not in ('left','removed','disconnected') and last_seen_at > now()-interval '35 seconds';
    if active_count<2 or not p_actor=any(r.roster) then raise exception using message='At least two people must be connected.',errcode='P0001'; end if;
    if exists(select 1 from public.room_participants where room_id=r.id and participant_id=any(r.roster) and (not ready or not camera_enabled)) then
      raise exception using message='Everyone needs a camera and must be ready first.',errcode='P0001'; end if;
    attempt:=gen_random_uuid(); scheduled:=now()+make_interval(secs=>r.countdown_seconds+1);
    update public.rooms set roster=r.roster,current_round=1,status='countdown',capture_id=attempt,capture_at=scheduled where id=r.id;
    update public.room_participants set status='countdown',capture_id=attempt,capture_at=scheduled where room_id=r.id and participant_id=any(r.roster);
  elsif p_action='captured' then
    if r.status not in ('countdown','capturing','uploading','reviewing') or not p_actor=any(r.roster) or actor.capture_id is distinct from (p_data->>'captureId')::uuid or r.current_round<>(p_data->>'round')::integer then
      raise exception using message='This capture is no longer current.',errcode='P0001'; end if;
    if actor.capture_at>now()+interval '1 second' then raise exception using message='Wait for the scheduled capture.',errcode='P0001'; end if;
    update public.room_participants set status='uploading',last_seen_at=now() where room_id=r.id and participant_id=p_actor and status not in ('reviewing','accepted');
    update public.rooms set status='uploading' where id=r.id and status in ('countdown','capturing');
  elsif p_action='store-photo' then
    if r.status not in ('countdown','capturing','uploading','reviewing') or not p_actor=any(r.roster) or r.current_round<>(p_data->>'round')::integer or actor.capture_id is distinct from (p_data->>'captureId')::uuid then
      raise exception using message='This capture was replaced. Take the current photo again.',errcode='P0001'; end if;
    if actor.capture_at>now()+interval '1 second' then raise exception using message='Wait for the scheduled capture.',errcode='P0001'; end if;
    if exists(select 1 from public.room_photos where room_id=r.id and participant_id=p_actor and round=r.current_round) then
      raise exception using message='This photo is already uploaded. Use Retake to replace it.',errcode='P0001'; end if;
    insert into public.room_photos(id,room_id,participant_id,round,capture_id,image_url,storage_path,captured_at)
      values((p_data->>'id')::uuid,r.id,p_actor,r.current_round,actor.capture_id,p_data->>'imageUrl',p_data->>'storagePath',(p_data->>'capturedAt')::timestamptz);
    update public.room_participants set status='reviewing',last_seen_at=now() where room_id=r.id and participant_id=p_actor;
    update public.rooms set status=case when (select count(*) from public.room_photos where room_id=r.id and round=r.current_round and participant_id=any(r.roster))=cardinality(r.roster) then 'reviewing' else 'uploading' end where id=r.id;
  elsif p_action='accept' then
    if r.current_round<>(p_data->>'round')::integer or actor.capture_id is distinct from (p_data->>'captureId')::uuid or not p_actor=any(r.roster) or r.status not in ('countdown','capturing','uploading','reviewing','round_complete') then
      raise exception using message='This review is no longer current.',errcode='P0001'; end if;
    update public.room_photos set approved=true where room_id=r.id and participant_id=p_actor and round=r.current_round and capture_id=actor.capture_id;
    if not found then raise exception using message='Upload your photo before accepting it.',errcode='P0001'; end if;
    update public.room_participants set status='accepted',last_seen_at=now() where room_id=r.id and participant_id=p_actor;
  elsif p_action='retake' then
    if r.status not in ('uploading','reviewing','round_complete','countdown','capturing') then raise exception using message='Retakes are unavailable at this stage.',errcode='P0001'; end if;
    if (p_data->>'all')::boolean is true then
      delete from public.room_photos where room_id=r.id and round=r.current_round;
      attempt:=gen_random_uuid(); scheduled:=now()+make_interval(secs=>r.countdown_seconds+1);
      update public.rooms set status='countdown',capture_id=attempt,capture_at=scheduled where id=r.id;
      update public.room_participants set status='countdown',capture_id=attempt,capture_at=scheduled where room_id=r.id and participant_id=any(r.roster);
    else
      target:=coalesce((p_data->>'participantId')::uuid,p_actor);
      if target<>p_actor or not target=any(r.roster) then raise exception using message='You can only retake your own photo.',errcode='P0003'; end if;
      delete from public.room_photos where room_id=r.id and participant_id=target and round=r.current_round;
      update public.room_participants set status='retaking',capture_id=gen_random_uuid(),capture_at=now()+make_interval(secs=>r.countdown_seconds+1) where room_id=r.id and participant_id=target;
      update public.rooms set status='uploading' where id=r.id;
    end if;
  elsif p_action='next' then
    if r.status<>'round_complete' then raise exception using message='Wait until everyone has approved this photo.',errcode='P0001'; end if;
  elsif p_action='leave' then
    update public.room_participants set status='left',ready=false,camera_enabled=false,last_seen_at=now()-interval '61 seconds' where room_id=r.id and participant_id=p_actor;
  elsif p_action='remove' then
    target:=(p_data->>'participantId')::uuid;
    if target=p_actor then raise exception using message='Use Leave Room to leave.',errcode='P0001'; end if;
    if r.status in ('generating','completed') then raise exception using message='The final layout is already being generated.',errcode='P0001'; end if;
    update public.room_participants set status='removed',ready=false,camera_enabled=false where room_id=r.id and participant_id=target;
    update public.rooms set roster=array_remove(roster,target) where id=r.id;
  elsif p_action='claim-host' then
    if exists(select 1 from public.room_participants where room_id=r.id and participant_id=r.host_participant_id and last_seen_at>now()-interval '60 seconds' and status not in ('left','removed')) then
      raise exception using message='The host is still connected. Host recovery is available after 60 seconds.',errcode='P0001'; end if;
    if actor.last_seen_at<now()-interval '35 seconds' or actor.status in ('left','disconnected') then raise exception using message='Reconnect before becoming host.',errcode='P0001'; end if;
    select participant_id into target from public.room_participants where room_id=r.id and status not in ('left','removed','disconnected') and last_seen_at>now()-interval '35 seconds' order by joined_at,participant_id limit 1;
    if target is distinct from p_actor then raise exception using message='Waiting for the earliest connected participant to become host.',errcode='P0001'; end if;
    update public.room_participants set is_host=(participant_id=p_actor) where room_id=r.id;
    update public.rooms set host_participant_id=p_actor where id=r.id;
  elsif p_action='end' then
    update public.rooms set status='ended' where id=r.id;
  elsif p_action='retry-generation' then
    if r.status<>'generating' then raise exception using message='The room is not ready to generate.',errcode='P0001'; end if;
  elsif p_action='store-result' then
    if r.status='completed' and r.result_id is not null then return public.booth_room_snapshot(r.id); end if;
    if r.status<>'generating' then raise exception using message='Every round must be approved before generating.',errcode='P0001'; end if;
    if (select count(*) from public.room_photos where room_id=r.id and participant_id=any(r.roster) and approved)<>cardinality(r.roster)*r.photo_count then
      raise exception using message='Some approved photos are missing.',errcode='P0001'; end if;
    insert into public.photobooths(id,session_id,image_url,storage_path,layout,frame,photo_count,custom_text,event_name,expires_at)
      values((p_data->>'id')::uuid,(p_data->>'sessionId')::uuid,p_data->>'imageUrl',p_data->>'storagePath',r.layout,r.frame,r.photo_count,'Pitik Booth','Booth Together',(p_data->>'expiresAt')::timestamptz);
    update public.rooms set status='completed',result_id=(p_data->>'id')::uuid where id=r.id;
  else
    raise exception using message='Unknown room action.',errcode='P0001';
  end if;

  -- Re-evaluate completion after accepting or explicitly removing a participant.
  -- A disconnection/heartbeat NEVER shortens the capture roster or advances a round.
  if p_action in ('accept','next','remove') then
    select * into r from public.rooms where id=r.id;
    complete_round:=r.current_round>0 and cardinality(r.roster)>0 and
      (select count(*) from public.room_photos where room_id=r.id and round=r.current_round and participant_id=any(r.roster) and approved)=cardinality(r.roster);
    if complete_round then
      if r.current_round=r.photo_count then update public.rooms set status='generating',capture_at=null where id=r.id;
      elsif r.auto_continue or p_action='next' then
        attempt:=gen_random_uuid(); scheduled:=now()+make_interval(secs=>r.countdown_seconds+1);
        update public.rooms set current_round=current_round+1,status='countdown',capture_id=attempt,capture_at=scheduled where id=r.id;
        update public.room_participants set status='countdown',capture_id=attempt,capture_at=scheduled where room_id=r.id and participant_id=any(r.roster);
      else update public.rooms set status='round_complete' where id=r.id;
      end if;
    end if;
  end if;
  update public.rooms set version=version+1 where id=r.id;
  return public.booth_room_snapshot(r.id);
end;
$$;

revoke all on function public.booth_room_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.booth_room_create(text,uuid,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.booth_room_command(text,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.booth_room_snapshot(uuid) to service_role;
grant execute on function public.booth_room_create(text,uuid,text,text,text,jsonb) to service_role;
grant execute on function public.booth_room_command(text,uuid,text,text,text,jsonb) to service_role;
commit;
