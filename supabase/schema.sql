-- ============================================================
-- note_invest — Full Database Schema (v2)
-- Run this entire file in Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ── 1. Sources table ─────────────────────────────────────────

create table if not exists public.sources (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null    default now(),
  user_id    uuid        not null    references auth.users(id) on delete cascade,
  name       text        not null,
  unique (user_id, name)
);

alter table public.sources enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='sources' and policyname='sources_select') then
    create policy "sources_select" on public.sources for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='sources' and policyname='sources_insert') then
    create policy "sources_insert" on public.sources for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='sources' and policyname='sources_update') then
    create policy "sources_update" on public.sources for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='sources' and policyname='sources_delete') then
    create policy "sources_delete" on public.sources for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── 2. Transactions table ────────────────────────────────────

create table if not exists public.transactions (
  id                 uuid        primary key default gen_random_uuid(),
  created_at         timestamptz not null    default now(),
  user_id            uuid        not null    references auth.users(id) on delete cascade,
  ticker             text        not null,
  company_name       text,
  type               text        not null    check (type in ('buy', 'sell')),
  pocket             text        not null    check (pocket in ('long_term', 'active')),
  quantity           numeric     not null    check (quantity >= 0),
  price              numeric     not null    check (price >= 0),
  date               date        not null,
  currency           text        not null    default 'USD' check (currency in ('EUR', 'USD')),
  source_id          uuid        references public.sources(id) on delete set null,
  notes              text,
  last_analysis_date date,
  support_price      numeric,
  resistance_price   numeric,
  tp1                numeric,
  tp2                numeric,
  tp3_fair_value     numeric
);

-- Safely add new columns when upgrading from older schema versions
alter table public.transactions
  add column if not exists company_name       text,
  add column if not exists last_analysis_date date,
  add column if not exists currency           text not null default 'USD',
  add column if not exists source_id          uuid references public.sources(id) on delete set null,
  add column if not exists support_price      numeric,
  add column if not exists resistance_price   numeric,
  add column if not exists tp1                numeric,
  add column if not exists tp2                numeric,
  add column if not exists tp3_fair_value     numeric;

-- Add currency check constraint if not already present
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_currency_check'
  ) then
    alter table public.transactions
      add constraint transactions_currency_check check (currency in ('EUR', 'USD'));
  end if;
end $$;

-- Allow quantity = 0 for watchlist entries (drop old > 0 constraint if exists)
alter table public.transactions
  drop constraint if exists transactions_quantity_check;
alter table public.transactions
  add constraint transactions_quantity_check check (quantity >= 0);

create index if not exists transactions_user_ticker_pocket_idx
  on public.transactions (user_id, ticker, pocket);

alter table public.transactions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='transactions' and policyname='owner_select') then
    create policy "owner_select" on public.transactions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='transactions' and policyname='owner_insert') then
    create policy "owner_insert" on public.transactions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='transactions' and policyname='owner_update') then
    create policy "owner_update" on public.transactions for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='transactions' and policyname='owner_delete') then
    create policy "owner_delete" on public.transactions for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── 3. Positions Summary view ────────────────────────────────

create or replace view public.positions_summary
  with (security_invoker = true)
as
select
  user_id,
  ticker,
  max(company_name)                                              as company_name,
  pocket,

  sum(
    case type
      when 'buy'  then  quantity
      when 'sell' then -quantity
    end
  )                                                              as net_quantity,

  sum(case when type = 'buy' then quantity * price else 0 end)
    / nullif(sum(case when type = 'buy' then quantity else 0 end), 0)
                                                                 as avg_price,

  sum(case when type = 'buy'  then quantity else 0 end)         as total_bought,
  sum(case when type = 'sell' then quantity else 0 end)         as total_sold,
  count(*)                                                       as transaction_count,
  max(date)                                                      as last_transaction_date,
  max(last_analysis_date)                                        as last_analysis_date

from public.transactions
group by user_id, ticker, pocket;
