-- Supabase SQL Schema for "আমাদের গল্প শুরু হোক 💌" (Amader Golpo)
-- Run this in your Supabase Dashboard -> SQL Editor

create table if not exists public.proposals (
  id text primary key,
  to_name text not null,
  from_name text default '',
  whatsapp text default '',
  question text default '',
  love_note text default '',
  theme text default 'pink',
  match_score integer default 98,
  status text default 'created', -- 'created' | 'opened' | 'accepted' | 'confirmed'
  no_dodges integer default 0,
  riddle_attempts integer default 0,
  math_question text default '',
  math_answer text default '',
  date_day text default '',
  date_time text default '',
  time_slot text default '',
  when_formatted text default '',
  location text default '',
  foods jsonb default '[]'::jsonb,
  gifts jsonb default '[]'::jsonb,
  dress_code text default '',
  reply_note text default '',
  summary_text text default '',
  created_at timestamptz default now(),
  opened_at timestamptz,
  accepted_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.proposals enable row level security;

-- Allow public read/insert/update via anon key as well as service_role
drop policy if exists "Allow public read proposals" on public.proposals;
create policy "Allow public read proposals"
  on public.proposals for select
  to anon, authenticated, service_role
  using (true);

drop policy if exists "Allow public insert proposals" on public.proposals;
create policy "Allow public insert proposals"
  on public.proposals for insert
  to anon, authenticated, service_role
  with check (true);

drop policy if exists "Allow public update proposals" on public.proposals;
create policy "Allow public update proposals"
  on public.proposals for update
  to anon, authenticated, service_role
  using (true)
  with check (true);
