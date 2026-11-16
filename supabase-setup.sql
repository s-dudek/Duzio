-- Duzio – Tabellen im gemeinsamen Supabase-Projekt der Übersicht (gleiche Anmeldung).
-- Alles ist privat: jede Person sieht und ändert nur eigene Zeilen (owner_id = auth.uid()).
-- Wiederholbar ausführbar (if not exists / drop policy if exists). Neue Änderungen unten anhängen.

-- Körperdaten und Ziele (eine Zeile je Person)
create table if not exists public.duzio_profile (
  owner_id     uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  sex          text check (sex in ('m', 'w')),
  birth_year   int check (birth_year between 1900 and 2100),
  height_cm    numeric check (height_cm between 80 and 250),
  activity     numeric check (activity between 1.1 and 2.2),          -- PAL-Faktor
  goal         text check (goal in ('lose', 'keep', 'gain')),
  goal_kg      numeric check (goal_kg between 20 and 400),
  kcal_goal    int check (kcal_goal between 800 and 6000),            -- leer = berechnet
  macro        jsonb not null default '{"c":50,"p":20,"f":30}',       -- Anteile in % der kcal
  water_goal   int not null default 2500 check (water_goal between 0 and 8000),
  updated_at   timestamptz not null default now()
);

-- Lebensmittel: eigene und von Open Food Facts übernommene (Werte je 100 g bzw. 100 ml)
create table if not exists public.duzio_foods (
  id          uuid primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null check (char_length(name) between 1 and 160),
  brand       text check (char_length(brand) <= 120),
  barcode     text check (barcode ~ '^[0-9]{6,14}$'),
  unit        text not null default 'g' check (unit in ('g', 'ml')),
  kcal        numeric not null default 0 check (kcal between 0 and 1000),
  protein     numeric not null default 0 check (protein between 0 and 100),
  fat         numeric not null default 0 check (fat between 0 and 100),
  carbs       numeric not null default 0 check (carbs between 0 and 100),
  sugar       numeric check (sugar between 0 and 100),
  fiber       numeric check (fiber between 0 and 100),
  salt        numeric check (salt between 0 and 100),
  portions    jsonb not null default '[]',                              -- [{ "n": "Stück", "g": 60 }]
  source      text not null default 'own' check (source in ('own', 'off')),
  fav         boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists duzio_foods_owner on public.duzio_foods (owner_id);

-- Rezepte: Zutaten mit Nährwerten je 100 g als Kopie (Rezept bleibt gleich, auch wenn das Lebensmittel geändert wird)
create table if not exists public.duzio_recipes (
  id           uuid primary key,
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title        text not null check (char_length(title) between 1 and 160),
  servings     numeric not null default 2 check (servings > 0 and servings <= 100),
  minutes      int check (minutes between 0 and 1440),
  tags         jsonb not null default '[]',
  ingredients  jsonb not null default '[]',   -- [{ "name", "g", "label", "aisle", "food_id", "kcal", "protein", "fat", "carbs" }]
  steps        jsonb not null default '[]',   -- ["Schritt", …]
  note         text check (char_length(note) <= 4000),
  fav          boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists duzio_recipes_owner on public.duzio_recipes (owner_id);

-- Tagebuch: je Eintrag Menge in Gramm und die Nährwerte als Kopie; planned = für später eingeplant (Einkaufsliste)
create table if not exists public.duzio_entries (
  id          uuid primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day         date not null,
  meal        text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name        text not null check (char_length(name) between 1 and 200),
  food_id     uuid references public.duzio_foods(id) on delete set null,
  recipe_id   uuid references public.duzio_recipes(id) on delete set null,
  amount      numeric not null check (amount > 0 and amount <= 100000),   -- in der gewählten Einheit
  unit_label  text not null default 'g' check (char_length(unit_label) <= 40),
  grams       numeric not null check (grams >= 0 and grams <= 100000),
  kcal        numeric not null default 0 check (kcal >= 0),
  protein     numeric not null default 0 check (protein >= 0),
  fat         numeric not null default 0 check (fat >= 0),
  carbs       numeric not null default 0 check (carbs >= 0),
  planned     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists duzio_entries_day on public.duzio_entries (owner_id, day);

-- Wasser je Tag
create table if not exists public.duzio_water (
  owner_id  uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day       date not null,
  ml        int not null default 0 check (ml between 0 and 20000),
  primary key (owner_id, day)
);

-- Gewicht je Tag
create table if not exists public.duzio_weights (
  owner_id  uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day       date not null,
  kg        numeric not null check (kg between 20 and 400),
  primary key (owner_id, day)
);

-- Einkaufsliste
create table if not exists public.duzio_shopping (
  id          uuid primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null check (char_length(name) between 1 and 160),
  qty         numeric check (qty >= 0 and qty <= 100000),
  unit        text check (char_length(unit) <= 40),
  aisle       text not null default 'Sonstiges' check (char_length(aisle) <= 40),
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists duzio_shopping_owner on public.duzio_shopping (owner_id);

-- Zugriffsregeln: nur eigene Zeilen
do $$
declare t text;
begin
  foreach t in array array['duzio_profile', 'duzio_foods', 'duzio_recipes', 'duzio_entries', 'duzio_water', 'duzio_weights', 'duzio_shopping'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "eigene Zeilen" on public.%I', t);
    execute format('create policy "eigene Zeilen" on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 15.11.2026: Mahlzeiten – gespeicherte Zusammenfassung (Nährwerte je Portion, Bestandteile als Liste),
-- auch aus einem Rezept umgewandelt (recipe_id). Tagebuch-Einträge verweisen mit saved_meal_id darauf.
create table if not exists public.duzio_meals (
  id          uuid primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title       text not null check (char_length(title) between 1 and 160),
  grams       numeric not null default 0 check (grams between 0 and 10000),   -- Gewicht einer Portion (0 = unbekannt)
  kcal        numeric not null default 0 check (kcal between 0 and 10000),    -- je Portion
  protein     numeric not null default 0 check (protein between 0 and 1000),
  fat         numeric not null default 0 check (fat between 0 and 1000),
  carbs       numeric not null default 0 check (carbs between 0 and 1000),
  items       jsonb not null default '[]',                                     -- [{ "name", "label" }]
  recipe_id   uuid references public.duzio_recipes(id) on delete set null,
  fav         boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists duzio_meals_owner on public.duzio_meals (owner_id);
alter table public.duzio_meals enable row level security;
drop policy if exists "eigene Zeilen" on public.duzio_meals;
create policy "eigene Zeilen" on public.duzio_meals for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.duzio_meals from anon;
grant select, insert, update, delete on public.duzio_meals to authenticated;
alter table public.duzio_entries add column if not exists saved_meal_id uuid references public.duzio_meals(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 16.11.2026: Apple Health – Schritte und aktive Energie je Tag (Gewicht geht in duzio_weights).
-- Die Werte schickt ein Kurzbefehl am iPhone an die Edge Function "duzio-health"
-- (Quelltext: supabase/functions/duzio-health/index.ts). Die App liest sie nur.
create table if not exists public.duzio_activity (
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day          date not null,
  steps        integer check (steps between 0 and 200000),
  active_kcal  numeric check (active_kcal between 0 and 20000),
  primary key (owner_id, day)
);
alter table public.duzio_activity enable row level security;
drop policy if exists "eigene Zeilen" on public.duzio_activity;
create policy "eigene Zeilen" on public.duzio_activity for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.duzio_activity from anon;
grant select, insert, update, delete on public.duzio_activity to authenticated;

-- Zugangsschlüssel des Kurzbefehls (nur als Hash gespeichert). Keine Zugriffsregel: nur die Edge Function liest ihn.
create table if not exists public.duzio_health_token (
  owner_id    uuid primary key references auth.users(id) on delete cascade,
  token_hash  text not null,
  created_at  timestamptz not null default now()
);
alter table public.duzio_health_token enable row level security;
revoke all on public.duzio_health_token from anon, authenticated;

-- Aktive Energie zum Tagesziel zählen (aus)
alter table public.duzio_profile add column if not exists burn_goal boolean not null default false;
