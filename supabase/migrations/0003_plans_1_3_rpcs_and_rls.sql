-- DevPrep Hub — Atomic RPCs for QuizAttempt & GitHub Sync + Cross-Entity FK RLS
-- Complies with ADR-005 (atomic multi-table RPCs), ADR-011, and GLOSSARY.md Invariant #8.

-- ============================================================================
-- 1. Strengthen Cross-Entity Ownership in RLS Policies
-- ============================================================================

drop policy if exists notes_owner_policy on public.notes;
create policy notes_owner_policy on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      skill_id is null
      or exists (
        select 1 from public.skills s
        where s.id = skill_id and s.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists quiz_attempts_owner_policy on public.quiz_attempts;
create policy quiz_attempts_owner_policy on public.quiz_attempts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
  );

drop policy if exists daily_digests_owner_policy on public.daily_digests;
create policy daily_digests_owner_policy on public.daily_digests
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      matched_skill_id is null
      or exists (
        select 1 from public.skills s
        where s.id = matched_skill_id and s.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists lab_submissions_owner_policy on public.lab_submissions;
create policy lab_submissions_owner_policy on public.lab_submissions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.track_modules tm
      join public.learning_tracks lt on lt.id = tm.track_id
      where tm.id = module_id and lt.user_id = (select auth.uid())
    )
  );

drop policy if exists interview_cards_owner_policy on public.interview_cards;
create policy interview_cards_owner_policy on public.interview_cards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
    and (
      lab_submission_id is null
      or exists (
        select 1 from public.lab_submissions ls
        where ls.id = lab_submission_id and ls.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists interview_attempts_owner_policy on public.interview_attempts;
create policy interview_attempts_owner_policy on public.interview_attempts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.interview_cards ic
      where ic.id = card_id and ic.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.skills s
      where s.id = skill_id and s.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 2. Atomic RPC: submit_quiz_attempt
-- ============================================================================

create or replace function public.submit_quiz_attempt(
  p_skill_id uuid,
  p_source_type public.quiz_source_type,
  p_score integer,
  p_total_questions integer,
  p_correct_answers integer,
  p_mastery_score integer,
  p_skill_status public.skill_status
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_locked_skill_id uuid;
  v_attempt_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_locked_skill_id
  from public.skills
  where id = p_skill_id and user_id = v_user_id
  for update;

  if v_locked_skill_id is null then
    raise exception 'Skill not found or unauthorized';
  end if;

  insert into public.quiz_attempts (
    user_id,
    skill_id,
    source_type,
    score,
    total_questions,
    correct_answers
  )
  values (
    v_user_id,
    p_skill_id,
    p_source_type,
    p_score,
    p_total_questions,
    p_correct_answers
  )
  returning id into v_attempt_id;

  update public.skills
  set mastery_score = p_mastery_score,
      status = p_skill_status,
      updated_at = now()
  where id = p_skill_id and user_id = v_user_id;

  return v_attempt_id;
end;
$$;

-- ============================================================================
-- 3. Atomic RPC: sync_github_skills
-- ============================================================================

create or replace function public.sync_github_skills(
  p_github_username text,
  p_skills jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item jsonb;
  v_slug text;
  v_existing_id uuid;
  v_existing_score integer;
  v_added integer := 0;
  v_upgraded integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, github_username, last_github_sync)
  values (v_user_id, p_github_username, now())
  on conflict (id) do update
  set github_username = excluded.github_username,
      last_github_sync = excluded.last_github_sync;

  if p_skills is not null and jsonb_typeof(p_skills) = 'array' then
    for v_item in select * from jsonb_array_elements(p_skills)
    loop
      v_slug := v_item ->> 'slug';
      if v_slug is null or v_slug = '' then
        continue;
      end if;

      select id, mastery_score
      into v_existing_id, v_existing_score
      from public.skills
      where user_id = v_user_id and slug = v_slug
      for update;

      if v_existing_id is null then
        insert into public.skills (
          user_id,
          name,
          slug,
          category,
          status,
          mastery_score,
          source
        )
        values (
          v_user_id,
          v_item ->> 'name',
          v_slug,
          (v_item ->> 'category')::public.skill_category,
          'learning'::public.skill_status,
          40,
          'github'::public.skill_source
        );
        v_added := v_added + 1;
      elsif v_existing_score < 40 then
        update public.skills
        set mastery_score = 40,
            status = 'learning'::public.skill_status,
            source = 'github'::public.skill_source,
            updated_at = now()
        where id = v_existing_id and user_id = v_user_id;
        v_upgraded := v_upgraded + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'addedCount', v_added,
    'upgradedCount', v_upgraded
  );
end;
$$;
