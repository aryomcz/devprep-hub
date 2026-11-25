-- DevPrep Hub — Initial Schema, RLS Policies, Triggers & Atomic RPCs
-- Canonical names & enum literals must stay aligned with docs/GLOSSARY.md.

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. Canonical Enums (14)
-- ============================================================================

create type public.skill_category as enum ('language', 'framework', 'concept', 'tool');
create type public.skill_status as enum ('gap', 'learning', 'mastered');
create type public.skill_source as enum ('github', 'jd', 'manual');
create type public.internship_status as enum ('preparing', 'applied', 'interview', 'offer', 'rejected');
create type public.skill_priority as enum ('must_have', 'nice_to_have');
create type public.resource_source as enum ('devto', 'stackoverflow', 'mdn', 'wikipedia', 'youtube', 'github');
create type public.track_status as enum ('active', 'completed', 'archived');
create type public.module_type as enum ('capstone_feature', 'microservice', 'language_native');
create type public.module_status as enum ('locked', 'in_progress', 'completed');
create type public.module_content_status as enum ('pending', 'ready', 'failed');
create type public.digest_source as enum ('devto', 'hackernews');
create type public.quiz_source_type as enum ('note_cloze', 'module_drill');
create type public.interview_card_source as enum ('lab_review', 'skill_gap', 'manual');
create type public.confidence_level as enum ('confused', 'partial', 'ready');

-- ============================================================================
-- 2. Tables & Indexes (13)
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  github_username text,
  last_github_sync timestamptz,
  created_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  category public.skill_category not null,
  status public.skill_status not null default 'gap',
  mastery_score integer not null default 0,
  source public.skill_source not null,
  updated_at timestamptz not null default now(),
  constraint skills_user_slug_unique unique (user_id, slug),
  constraint skills_mastery_score_range check (mastery_score between 0 and 100),
  constraint skills_status_matches_score check (
    (status = 'gap' and mastery_score between 0 and 29)
    or (status = 'learning' and mastery_score between 30 and 79)
    or (status = 'mastered' and mastery_score between 80 and 100)
  )
);

create table public.target_internships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company_name text not null default '',
  industry text not null default '',
  raw_input text not null,
  jargon_glossary jsonb not null default '[]'::jsonb,
  status public.internship_status not null default 'preparing',
  created_at timestamptz not null default now(),
  constraint target_internships_raw_input_len check (char_length(raw_input) <= 15000)
);
create index target_internships_user_created_idx
  on public.target_internships (user_id, created_at desc);

create table public.internship_skills (
  internship_id uuid not null references public.target_internships(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  priority public.skill_priority not null,
  primary key (internship_id, skill_id)
);
create index internship_skills_skill_id_idx
  on public.internship_skills (skill_id);

create table public.curated_resources (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  source public.resource_source not null,
  title text not null,
  url text not null,
  summary text not null default '',
  fetched_at timestamptz not null default now(),
  constraint curated_resources_skill_url_unique unique (skill_id, url)
);

create table public.learning_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  internship_id uuid references public.target_internships(id) on delete set null,
  capstone_title text not null,
  capstone_description text not null,
  primary_stack text not null,
  architecture_overview text not null,
  status public.track_status not null default 'active',
  created_at timestamptz not null default now()
);
create index learning_tracks_user_created_idx
  on public.learning_tracks (user_id, created_at desc);
create index learning_tracks_internship_id_idx
  on public.learning_tracks (internship_id);

create table public.track_modules (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.learning_tracks(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  order_index integer not null check (order_index >= 0),
  module_type public.module_type not null,
  target_language text not null,
  objective text not null,
  content_status public.module_content_status not null default 'pending',
  concept_brief jsonb,
  warmup_drills jsonb,
  hands_on_ticket jsonb,
  status public.module_status not null default 'locked',
  constraint track_modules_track_order_unique unique (track_id, order_index),
  constraint track_modules_ready_content_check check (
    content_status <> 'ready'
    or (concept_brief is not null and warmup_drills is not null and hands_on_ticket is not null)
  )
);
create index track_modules_skill_id_idx
  on public.track_modules (skill_id);

create table public.lab_submissions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.track_modules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code_snippet text not null default '',
  repo_commit_url text not null default '',
  ai_review_feedback jsonb not null,
  generated_interview_qs jsonb not null,
  passed boolean not null default false,
  submitted_at timestamptz not null default now()
);
create index lab_submissions_module_submitted_idx
  on public.lab_submissions (module_id, submitted_at desc);
create index lab_submissions_user_submitted_idx
  on public.lab_submissions (user_id, submitted_at desc);

create table public.daily_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source public.digest_source not null,
  external_id text not null,
  title text not null,
  url text not null,
  tags text[] not null default '{}',
  matched_skill_id uuid references public.skills(id) on delete set null,
  is_read boolean not null default false,
  digest_date date not null default current_date,
  constraint daily_digests_user_source_ext_unique unique (user_id, source, external_id)
);
create index daily_digests_user_date_idx
  on public.daily_digests (user_id, digest_date desc);
create index daily_digests_matched_skill_id_idx
  on public.daily_digests (matched_skill_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  title text not null,
  content_md text not null default '',
  gist_id text,
  updated_at timestamptz not null default now()
);
create index notes_user_updated_idx
  on public.notes (user_id, updated_at desc);
create index notes_skill_id_idx
  on public.notes (skill_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  source_type public.quiz_source_type not null,
  score integer not null check (score between 0 and 100),
  total_questions integer not null check (total_questions > 0),
  correct_answers integer not null check (correct_answers >= 0 and correct_answers <= total_questions),
  attempted_at timestamptz not null default now()
);
create index quiz_attempts_user_attempted_idx
  on public.quiz_attempts (user_id, attempted_at desc);
create index quiz_attempts_skill_attempted_idx
  on public.quiz_attempts (skill_id, attempted_at desc);

create table public.interview_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  lab_submission_id uuid references public.lab_submissions(id) on delete set null,
  question_prompt text not null,
  source public.interview_card_source not null,
  confidence_level public.confidence_level,
  review_count integer not null default 0 check (review_count >= 0),
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index interview_cards_user_next_review_idx
  on public.interview_cards (user_id, next_review_at asc);
create index interview_cards_user_skill_idx
  on public.interview_cards (user_id, skill_id);
create index interview_cards_lab_submission_id_idx
  on public.interview_cards (lab_submission_id);

create table public.interview_attempts (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.interview_cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  user_notes text not null default '',
  duration_seconds integer not null check (duration_seconds >= 0),
  confidence_level public.confidence_level not null,
  attempted_at timestamptz not null default now()
);
create index interview_attempts_user_attempted_idx
  on public.interview_attempts (user_id, attempted_at desc);
create index interview_attempts_card_attempted_idx
  on public.interview_attempts (card_id, attempted_at desc);
create index interview_attempts_skill_attempted_idx
  on public.interview_attempts (skill_id, attempted_at desc);

-- ============================================================================
-- 3. Auth User Trigger -> profiles
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, github_username)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'user_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 4. Row Level Security (All 13 Tables, InitPlan-cached auth.uid())
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.target_internships enable row level security;
alter table public.internship_skills enable row level security;
alter table public.curated_resources enable row level security;
alter table public.learning_tracks enable row level security;
alter table public.track_modules enable row level security;
alter table public.lab_submissions enable row level security;
alter table public.daily_digests enable row level security;
alter table public.notes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.interview_cards enable row level security;
alter table public.interview_attempts enable row level security;

create policy profiles_owner_policy on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy skills_owner_policy on public.skills
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy target_internships_owner_policy on public.target_internships
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy internship_skills_owner_policy on public.internship_skills
  for all to authenticated
  using (
    exists (
      select 1 from public.target_internships ti
      where ti.id = internship_id and ti.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.target_internships ti
      where ti.id = internship_id and ti.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
  );

create policy curated_resources_owner_policy on public.curated_resources
  for all to authenticated
  using (
    exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
  );

create policy learning_tracks_owner_policy on public.learning_tracks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy track_modules_owner_policy on public.track_modules
  for all to authenticated
  using (
    exists (
      select 1 from public.learning_tracks lt
      where lt.id = track_id and lt.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.learning_tracks lt
      where lt.id = track_id and lt.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
  );

create policy lab_submissions_owner_policy on public.lab_submissions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy daily_digests_owner_policy on public.daily_digests
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy notes_owner_policy on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy quiz_attempts_owner_policy on public.quiz_attempts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy interview_cards_owner_policy on public.interview_cards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy interview_attempts_owner_policy on public.interview_attempts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================================
-- 5. Atomic PostgreSQL RPC Functions
-- ============================================================================

create or replace function public.save_internship_analysis(
  p_title text,
  p_company_name text,
  p_industry text,
  p_raw_input text,
  p_jargon_glossary jsonb,
  p_skills jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_internship_id uuid;
  v_item jsonb;
  v_skill_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.target_internships (
    user_id,
    title,
    company_name,
    industry,
    raw_input,
    jargon_glossary
  )
  values (
    v_user_id,
    p_title,
    coalesce(p_company_name, ''),
    coalesce(p_industry, ''),
    p_raw_input,
    coalesce(p_jargon_glossary, '[]'::jsonb)
  )
  returning id into v_internship_id;

  if p_skills is not null and jsonb_typeof(p_skills) = 'array' then
    for v_item in select * from jsonb_array_elements(p_skills)
    loop
      insert into public.skills (user_id, name, slug, category, status, mastery_score, source)
      values (
        v_user_id,
        v_item ->> 'name',
        v_item ->> 'slug',
        (v_item ->> 'category')::public.skill_category,
        'gap'::public.skill_status,
        0,
        'jd'::public.skill_source
      )
      on conflict (user_id, slug) do nothing;

      select s.id into v_skill_id
      from public.skills s
      where s.user_id = v_user_id and s.slug = (v_item ->> 'slug');

      insert into public.internship_skills (internship_id, skill_id, priority)
      values (
        v_internship_id,
        v_skill_id,
        (v_item ->> 'priority')::public.skill_priority
      )
      on conflict (internship_id, skill_id) do update
      set priority = case
        when public.internship_skills.priority = 'must_have'::public.skill_priority
          or excluded.priority = 'must_have'::public.skill_priority
        then 'must_have'::public.skill_priority
        else 'nice_to_have'::public.skill_priority
      end;
    end loop;
  end if;

  return v_internship_id;
end;
$$;

create or replace function public.merge_skills(
  p_source_skill_id uuid,
  p_target_skill_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lock_count integer;
  v_source_score integer;
  v_target_score integer;
  v_merged_score integer;
  v_merged_status public.skill_status;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_source_skill_id = p_target_skill_id then
    raise exception 'Source and target skill must differ';
  end if;

  -- Lock both rows in deterministic UUID order to prevent deadlocks
  select count(*) into v_lock_count
  from (
    select id
    from public.skills
    where user_id = v_user_id and id in (p_source_skill_id, p_target_skill_id)
    order by id
    for update
  ) locked;

  if v_lock_count <> 2 then
    raise exception 'Skills not found or unauthorized';
  end if;

  select mastery_score into v_source_score
  from public.skills where id = p_source_skill_id and user_id = v_user_id;

  select mastery_score into v_target_score
  from public.skills where id = p_target_skill_id and user_id = v_user_id;

  insert into public.internship_skills (internship_id, skill_id, priority)
  select internship_id, p_target_skill_id, priority
  from public.internship_skills
  where skill_id = p_source_skill_id
  on conflict (internship_id, skill_id) do update
  set priority = case
    when public.internship_skills.priority = 'must_have'::public.skill_priority
      or excluded.priority = 'must_have'::public.skill_priority
    then 'must_have'::public.skill_priority
    else 'nice_to_have'::public.skill_priority
  end;

  delete from public.internship_skills where skill_id = p_source_skill_id;

  delete from public.curated_resources cr_src
  where cr_src.skill_id = p_source_skill_id
    and exists (
      select 1 from public.curated_resources cr_dst
      where cr_dst.skill_id = p_target_skill_id and cr_dst.url = cr_src.url
    );

  update public.curated_resources
  set skill_id = p_target_skill_id
  where skill_id = p_source_skill_id;

  update public.notes set skill_id = p_target_skill_id where skill_id = p_source_skill_id;
  update public.quiz_attempts set skill_id = p_target_skill_id where skill_id = p_source_skill_id;
  update public.daily_digests set matched_skill_id = p_target_skill_id where matched_skill_id = p_source_skill_id;
  update public.track_modules set skill_id = p_target_skill_id where skill_id = p_source_skill_id;
  update public.interview_cards set skill_id = p_target_skill_id where skill_id = p_source_skill_id;
  update public.interview_attempts set skill_id = p_target_skill_id where skill_id = p_source_skill_id;

  v_merged_score := greatest(v_source_score, v_target_score);
  v_merged_status := case
    when v_merged_score >= 80 then 'mastered'::public.skill_status
    when v_merged_score >= 30 then 'learning'::public.skill_status
    else 'gap'::public.skill_status
  end;

  update public.skills
  set mastery_score = v_merged_score,
      status = v_merged_status,
      updated_at = now()
  where id = p_target_skill_id and user_id = v_user_id;

  delete from public.skills
  where id = p_source_skill_id and user_id = v_user_id;
end;
$$;
