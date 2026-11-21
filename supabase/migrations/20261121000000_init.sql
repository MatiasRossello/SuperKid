-- SuperKid schema. All times are timestamptz (UTC); convert to Mendoza (UTC-3) only for display.

create table radar_frames (
  date text not null,          -- YYYYMMDD (UTC)
  time_utc text not null,      -- HHMMSS
  types text[] not null,
  primary key (date, time_utc)
);

create table hail_impacts (
  id bigint generated always as identity primary key,
  departamento text not null,
  paraje text,
  prob_max real not null,
  area_km2 real not null,
  hora_inicio text not null,   -- HH:MM UTC; frame time for per-frame impacts
  hora_fin text not null,
  frame_date text not null,    -- YYYYMMDD of the DACC operative day
  source text not null,        -- 'frame' | 'daily' | 'replay'
  created_at timestamptz not null default now(),
  unique (departamento, hora_inicio, hora_fin, frame_date)
);

create table station_readings (
  estacion text not null,
  nombre text not null,
  departamento text,
  lat double precision not null,
  lng double precision not null,
  temp real, humedad real, viento real, precipitacion real,
  read_at timestamptz not null,
  primary key (estacion, read_at)
);

create table forecasts (
  fecha date primary key,
  texto text not null,
  maxima real, minima real,
  alerta int,
  imagen text,
  updated_at timestamptz not null default now()
);

create table smn_alerts (
  id bigint generated always as identity primary key,
  zona text, nivel text, evento text,
  desde timestamptz, hasta timestamptz,
  raw jsonb not null,
  fetched_at timestamptz not null default now()
);

create table zone_status (
  departamento text primary key,
  level smallint not null default 0 check (level between 0 and 5),
  summary text,
  sources jsonb not null default '[]',
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  departamento text not null,
  created_at timestamptz not null default now()
);

create table notifications_log (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references push_subscriptions on delete cascade,
  departamento text not null,
  level smallint not null,
  sent_at timestamptz not null default now()
);
create index on notifications_log (subscription_id, sent_at desc);

-- Public data is readable by anyone; all writes go through the server with the service role.
alter table radar_frames enable row level security;
alter table hail_impacts enable row level security;
alter table station_readings enable row level security;
alter table forecasts enable row level security;
alter table smn_alerts enable row level security;
alter table zone_status enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications_log enable row level security;

create policy "public read" on radar_frames for select using (true);
create policy "public read" on hail_impacts for select using (true);
create policy "public read" on station_readings for select using (true);
create policy "public read" on forecasts for select using (true);
create policy "public read" on zone_status for select using (true);

insert into zone_status (departamento)
select unnest(array['Capital','Godoy Cruz','Guaymallén','Las Heras','Luján de Cuyo','Maipú','Lavalle','San Martín','Rivadavia','Junín','Santa Rosa','La Paz','Tunuyán','Tupungato','San Carlos','San Rafael','General Alvear','Malargüe']);
