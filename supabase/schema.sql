-- Vokabelapp database schema.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Sharing model:
--   shared by all accounts: clusters, vocab (the word pool)
--   personal per account:   cards (activations/phases), reviews, settings, personal notes
--   everyone can add words; only the admin can edit or delete them.
-- The first account created after running this script becomes the admin.

-- ---------------------------------------------------------------------------
-- Profiles: one per account, created automatically. Display names are visible to
-- all accounts (for the leaderboard later); is_admin can only be changed in the dashboard.
-- ---------------------------------------------------------------------------
create table profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create function is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------------
-- Clusters (shared): thematic groups ("Environment & Climate"), one set per language.
-- ---------------------------------------------------------------------------
create table clusters (
  id          uuid primary key default gen_random_uuid(),
  language    text not null check (language in ('en', 'es')),
  name        text not null,
  description text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  unique (language, name)
);

-- ---------------------------------------------------------------------------
-- Vocab (shared): the pool. One row per foreign word, independent of learning progress.
-- ---------------------------------------------------------------------------
create table vocab (
  id           uuid primary key default gen_random_uuid(),
  language     text not null check (language in ('en', 'es')),
  cluster_id   uuid references clusters on delete set null,

  -- The foreign word as it must be typed: Spanish nouns with article ("la ventana"),
  -- English verbs with "to" ("to relinquish"; "to" is optional when answering).
  term         text not null,
  word_type    text check (word_type in
                 ('noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'phrase', 'other')),

  -- German meanings, each with an optional context hint:
  -- [{"de": "die Bank", "context": "Geldinstitut"}, {"de": "das Ufer", "context": "Fluss"}]
  translations jsonb not null default '[]'::jsonb,

  ipa          text,                       -- American English pronunciation (English only)
  gender       text check (gender in ('m', 'f', 'm/f')),  -- Spanish nouns
  plural       text,                       -- irregular or noteworthy plurals
  forms        jsonb,                      -- irregular forms, e.g. {"presente": "tengo, tienes, ...", "indefinido": "tuve, ..."}
  region       text,                       -- only set when regional, e.g. "Spain", "Latin America", "Mexico"
  synonyms     text[] not null default '{}',
  example      text,                       -- example sentence in the foreign language
  example_de   text,                       -- its German translation
  notes        text,                       -- shared usage notes (personal notes live in vocab_notes)
  level        text check (level in ('B1', 'B2', 'C1', 'C2')),
  tags         text[] not null default '{}',
  is_draft     boolean not null default false,  -- quick add, to be completed by the admin via Claude Code

  created_by   uuid default auth.uid() references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index vocab_unique_term on vocab (language, lower(term), coalesce(word_type, ''));
create index vocab_cluster on vocab (cluster_id);

-- ---------------------------------------------------------------------------
-- Personal notes on a shared word.
-- ---------------------------------------------------------------------------
create table vocab_notes (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  vocab_id   uuid not null references vocab on delete cascade,
  note       text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, vocab_id)
);

-- ---------------------------------------------------------------------------
-- Cards (personal): a word activated in one direction. No card = phase 0 (inactive).
-- The unique constraint is what prevents activating a word twice in the same direction.
-- ---------------------------------------------------------------------------
create table cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  vocab_id         uuid not null references vocab on delete cascade,
  direction        text not null check (direction in ('to_foreign', 'to_german')),
  phase            int  not null default 1 check (phase >= 0),
  due_at           timestamptz not null default now(),
  learned_at       timestamptz,            -- set once the last phase was passed
  activated_at     timestamptz not null default now(),
  last_reviewed_at timestamptz,
  unique (user_id, vocab_id, direction)
);

create index cards_due on cards (user_id, direction, due_at) where learned_at is null;

-- ---------------------------------------------------------------------------
-- Reviews (personal): every answer ever given. Basis for statistics, streaks,
-- daily goals and the leaderboard (which will only expose aggregates).
-- ---------------------------------------------------------------------------
create table reviews (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  card_id      uuid references cards on delete set null,
  language     text not null check (language in ('en', 'es')),
  direction    text not null check (direction in ('to_foreign', 'to_german')),
  answer       text,
  -- correct  = typed exactly right
  -- accepted = not exact (or an alternative), but counted as correct by choice
  -- down_one = dropped back one phase
  -- reset    = dropped back to phase 1
  result       text not null check (result in ('correct', 'accepted', 'down_one', 'reset')),
  phase_before int not null,
  phase_after  int not null,
  reviewed_at  timestamptz not null default now()
);

create index reviews_time on reviews (user_id, reviewed_at);

-- ---------------------------------------------------------------------------
-- Settings (personal): one row per account, created automatically.
-- ---------------------------------------------------------------------------
create table settings (
  user_id                   uuid primary key default auth.uid() references auth.users on delete cascade,
  -- Review interval in days for phase 1..N. Passing phase N marks the word as learned.
  phase_intervals           int[] not null default '{1,3,7,14,30,90,180,365,1095}',
  session_size              int not null default 30 check (session_size > 0),
  -- When the answer is correct but other translations exist: show them and ask for the 3-way choice.
  confirm_alternatives      boolean not null default true,
  -- Newly activated words can be practised right away instead of waiting for the phase-1 interval.
  new_cards_due_immediately boolean not null default true,
  updated_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- New account -> profile + settings. The very first account becomes admin.
-- ---------------------------------------------------------------------------
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name, is_admin)
  values (new.id, split_part(new.email, '@', 1), not exists (select 1 from public.profiles));
  insert into public.settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table profiles    enable row level security;
alter table clusters    enable row level security;
alter table vocab       enable row level security;
alter table vocab_notes enable row level security;
alter table cards       enable row level security;
alter table reviews     enable row level security;
alter table settings    enable row level security;

-- Profiles: everyone logged in sees names; each person may only rename themselves.
create policy read_all   on profiles for select to authenticated using (true);
create policy update_own on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on profiles from anon, authenticated;
grant update (display_name) on profiles to authenticated;

-- Shared pool: everyone reads and adds; only the admin edits or deletes.
create policy read_all     on clusters for select to authenticated using (true);
create policy admin_insert on clusters for insert to authenticated with check (is_admin());
create policy admin_update on clusters for update to authenticated using (is_admin()) with check (is_admin());
create policy admin_delete on clusters for delete to authenticated using (is_admin());

create policy read_all     on vocab for select to authenticated using (true);
create policy insert_own   on vocab for insert to authenticated with check (created_by = auth.uid());
create policy admin_update on vocab for update to authenticated using (is_admin()) with check (is_admin());
create policy admin_delete on vocab for delete to authenticated using (is_admin());

-- Personal tables: each person sees and changes only their own rows.
create policy own_rows on vocab_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on cards       for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on reviews     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on settings    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Keep updated_at current.
-- ---------------------------------------------------------------------------
create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger vocab_touch       before update on vocab       for each row execute function touch_updated_at();
create trigger vocab_notes_touch before update on vocab_notes for each row execute function touch_updated_at();
create trigger settings_touch    before update on settings    for each row execute function touch_updated_at();
