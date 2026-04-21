create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.chat_memories (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  region text not null check (region in ('CN', 'HK')),
  user_prompt text not null,
  assistant_response text not null,
  summary text not null,
  embedding vector(256) not null,
  is_favorite boolean not null default false,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.chat_memories enable row level security;

drop policy if exists "chat_memories_select_anon" on public.chat_memories;
create policy "chat_memories_select_anon"
  on public.chat_memories
  for select
  to anon
  using (true);

drop policy if exists "chat_memories_insert_anon" on public.chat_memories;
create policy "chat_memories_insert_anon"
  on public.chat_memories
  for insert
  to anon
  with check (true);

drop policy if exists "chat_memories_update_anon" on public.chat_memories;
create policy "chat_memories_update_anon"
  on public.chat_memories
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "chat_memories_delete_anon" on public.chat_memories;
create policy "chat_memories_delete_anon"
  on public.chat_memories
  for delete
  to anon
  using (true);

comment on table public.chat_memories is 'Regionalized chat turns and favorite samples used for lightweight RAG recall.';
comment on column public.chat_memories.region is 'CN = Mainland copy tone, HK = Hong Kong copy tone.';
comment on column public.chat_memories.summary is 'Compact retrieval text joined from user intent + assistant answer.';
comment on column public.chat_memories.embedding is '256-d local deterministic vector used when external embedding APIs are unavailable.';

create index if not exists chat_memories_session_idx
  on public.chat_memories (session_id, created_at desc);

create index if not exists chat_memories_region_idx
  on public.chat_memories (region, is_favorite, created_at desc);

create index if not exists chat_memories_metadata_gin_idx
  on public.chat_memories using gin (metadata);

create index if not exists chat_memories_embedding_idx
  on public.chat_memories
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 64);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists chat_memories_touch_updated_at on public.chat_memories;
create trigger chat_memories_touch_updated_at
before update on public.chat_memories
for each row execute function public.touch_updated_at();

create or replace function public.match_favorite_chat_memories(
  query_embedding_text text,
  match_count integer default 4,
  match_region text default null
)
returns table (
  id uuid,
  session_id text,
  region text,
  user_prompt text,
  assistant_response text,
  summary text,
  similarity double precision,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
as $$
  select
    cm.id,
    cm.session_id,
    cm.region,
    cm.user_prompt,
    cm.assistant_response,
    cm.summary,
    1 - (cm.embedding <=> query_embedding_text::vector(256)) as similarity,
    cm.metadata,
    cm.created_at
  from public.chat_memories cm
  where cm.is_favorite = true
    and (match_region is null or cm.region = match_region)
  order by cm.embedding <=> query_embedding_text::vector(256), cm.created_at desc
  limit greatest(match_count, 1);
$$;
