-- Run once in Supabase: SQL Editor > New query > paste > Run
create table profiles (id uuid primary key references auth.users on delete cascade, name text, city text, bio text, av int default 0);
create table trips (id text primary key, code text unique not null, owner uuid not null, data jsonb not null, updated_at timestamptz default now());
create table trip_members (trip_id text references trips on delete cascade, user_id uuid references auth.users on delete cascade, primary key (trip_id, user_id));
alter table profiles enable row level security;
alter table trips enable row level security;
alter table trip_members enable row level security;

create policy p_sel on profiles for select to authenticated using (true);
create policy p_ins on profiles for insert to authenticated with check (id = auth.uid());
create policy p_upd on profiles for update to authenticated using (id = auth.uid());
create policy p_del on profiles for delete to authenticated using (id = auth.uid());

create policy t_sel on trips for select to authenticated using (owner = auth.uid() or exists (select 1 from trip_members m where m.trip_id = trips.id and m.user_id = auth.uid()));
create policy t_ins on trips for insert to authenticated with check (owner = auth.uid());
create policy t_upd on trips for update to authenticated using (owner = auth.uid() or exists (select 1 from trip_members m where m.trip_id = trips.id and m.user_id = auth.uid()));
create policy t_del on trips for delete to authenticated using (owner = auth.uid());

create policy m_sel on trip_members for select to authenticated using (user_id = auth.uid());
create policy m_del on trip_members for delete to authenticated using (user_id = auth.uid());

create function add_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into trip_members values (new.id, new.owner) on conflict do nothing; return new; end $$;
create trigger trg_owner after insert on trips for each row execute function add_owner();

create function join_trip(p_code text) returns trips language plpgsql security definer set search_path = public as $$
declare t trips; nm text;
begin
  select * into t from trips where code = p_code;
  if not found then return null; end if;
  insert into trip_members (trip_id, user_id) values (t.id, auth.uid()) on conflict do nothing;
  if not exists (select 1 from jsonb_array_elements(t.data->'members') m where m->>'id' = auth.uid()::text) then
    select coalesce(name, 'Member') into nm from profiles where id = auth.uid();
    update trips set data = jsonb_set(data, '{members}', (data->'members') || jsonb_build_array(jsonb_build_object('id', auth.uid()::text, 'name', coalesce(nm, 'Member')))) where id = t.id returning * into t;
  end if;
  return t;
end $$;
