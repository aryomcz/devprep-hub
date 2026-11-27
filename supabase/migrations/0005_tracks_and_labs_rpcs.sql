-- DevPrep Hub — Atomic RPCs for LearningTrack Creation, Module Progression & Lab Review
-- Complies with ADR-005 (atomic multi-table RPCs) and ADR-011.

-- ============================================================================
-- 1. Atomic RPC: create_track_with_modules
-- ============================================================================

create or replace function public.create_track_with_modules(
  p_internship_id uuid,
  p_capstone_title text,
  p_capstone_description text,
  p_primary_stack text,
  p_architecture_overview text,
  p_modules jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_track_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_internship_id is not null and not exists (
    select 1 from public.target_internships
    where id = p_internship_id and user_id = v_user_id
  ) then
    raise exception 'Target internship not found or unauthorized';
  end if;

  if p_modules is null or jsonb_typeof(p_modules) <> 'array' or jsonb_array_length(p_modules) = 0 then
    raise exception 'Learning track requires at least one module';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_modules) as elem
    where not exists (
      select 1 from public.skills s
      where s.id = (elem ->> 'skill_id')::uuid and s.user_id = v_user_id
    )
  ) then
    raise exception 'One or more module skills not found or unauthorized';
  end if;

  insert into public.learning_tracks (
    user_id,
    internship_id,
    capstone_title,
    capstone_description,
    primary_stack,
    architecture_overview,
    status
  )
  values (
    v_user_id,
    p_internship_id,
    p_capstone_title,
    p_capstone_description,
    p_primary_stack,
    p_architecture_overview,
    'active'::public.track_status
  )
  returning id into v_track_id;

  insert into public.track_modules (
    track_id,
    skill_id,
    order_index,
    module_type,
    target_language,
    objective,
    content_status,
    concept_brief,
    warmup_drills,
    hands_on_ticket,
    status
  )
  select
    v_track_id,
    (t.elem ->> 'skill_id')::uuid,
    (t.elem ->> 'order_index')::integer,
    (t.elem ->> 'module_type')::public.module_type,
    coalesce(t.elem ->> 'target_language', ''),
    t.elem ->> 'objective',
    'pending'::public.module_content_status,
    null,
    null,
    null,
    case
      when t.ord = 1 then 'in_progress'::public.module_status
      else 'locked'::public.module_status
    end
  from jsonb_array_elements(p_modules) with ordinality as t(elem, ord);

  return v_track_id;
end;
$$;

-- ============================================================================
-- 2. Atomic RPC: complete_and_unlock_next_module
-- ============================================================================

create or replace function public.complete_and_unlock_next_module(
  p_track_id uuid,
  p_module_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_locked_track_id uuid;
  v_current_order integer;
  v_current_status public.module_status;
  v_unlocked_id uuid;
  v_track_completed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_locked_track_id
  from public.learning_tracks
  where id = p_track_id and user_id = v_user_id
  for update;

  if v_locked_track_id is null then
    raise exception 'Learning Track tidak ditemukan.';
  end if;

  perform 1
  from public.track_modules
  where track_id = p_track_id
  for update;

  select order_index, status
  into v_current_order, v_current_status
  from public.track_modules
  where id = p_module_id and track_id = p_track_id;

  if v_current_order is null then
    raise exception 'Modul tidak ditemukan pada track ini.';
  end if;

  if v_current_status = 'locked'::public.module_status then
    raise exception 'Modul terkunci tidak dapat diselesaikan secara langsung.';
  end if;

  update public.track_modules
  set status = 'completed'::public.module_status
  where id = p_module_id and track_id = p_track_id;

  select id into v_unlocked_id
  from public.track_modules
  where track_id = p_track_id
    and status = 'locked'::public.module_status
    and order_index > v_current_order
  order by order_index asc, id asc
  limit 1;

  if v_unlocked_id is not null then
    update public.track_modules
    set status = 'in_progress'::public.module_status
    where id = v_unlocked_id and track_id = p_track_id;
  end if;

  if not exists (
    select 1 from public.track_modules
    where track_id = p_track_id
      and status <> 'completed'::public.module_status
  ) then
    update public.learning_tracks
    set status = 'completed'::public.track_status
    where id = p_track_id and user_id = v_user_id;
    v_track_completed := true;
  end if;

  return jsonb_build_object(
    'unlockedModuleId', v_unlocked_id,
    'trackCompleted', v_track_completed
  );
end;
$$;

-- ============================================================================
-- 3. Atomic RPC: submit_lab_review
-- ============================================================================

create or replace function public.submit_lab_review(
  p_track_id uuid,
  p_module_id uuid,
  p_skill_id uuid,
  p_code_snippet text,
  p_repo_commit_url text,
  p_ai_review_feedback jsonb,
  p_interview_questions jsonb,
  p_passed boolean,
  p_mastery_score integer,
  p_skill_status public.skill_status
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_locked_track_id uuid;
  v_locked_skill_id uuid;
  v_module_status public.module_status;
  v_module_content_status public.module_content_status;
  v_submission_id uuid;
  v_submitted_at timestamptz;
  v_progress jsonb;
  v_unlocked_id uuid;
  v_track_completed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_locked_track_id
  from public.learning_tracks
  where id = p_track_id and user_id = v_user_id
  for update;

  if v_locked_track_id is null then
    raise exception 'Track atau modul tidak ditemukan.';
  end if;

  select id into v_locked_skill_id
  from public.skills
  where id = p_skill_id and user_id = v_user_id
  for update;

  if v_locked_skill_id is null then
    raise exception 'Skill terkait modul tidak ditemukan.';
  end if;

  select status, content_status
  into v_module_status, v_module_content_status
  from public.track_modules
  where id = p_module_id and track_id = p_track_id
  for update;

  if v_module_status is null then
    raise exception 'Track atau modul tidak ditemukan.';
  end if;

  if v_module_status = 'locked'::public.module_status then
    raise exception 'Modul masih terkunci.';
  end if;

  if v_module_content_status <> 'ready'::public.module_content_status then
    raise exception 'Materi modul belum siap.';
  end if;

  insert into public.lab_submissions (
    module_id,
    user_id,
    code_snippet,
    repo_commit_url,
    ai_review_feedback,
    generated_interview_qs,
    passed
  )
  values (
    p_module_id,
    v_user_id,
    coalesce(p_code_snippet, ''),
    coalesce(p_repo_commit_url, ''),
    p_ai_review_feedback,
    p_interview_questions,
    p_passed
  )
  returning id, submitted_at into v_submission_id, v_submitted_at;

  if p_interview_questions is not null and jsonb_typeof(p_interview_questions) = 'array' then
    insert into public.interview_cards (
      user_id,
      skill_id,
      lab_submission_id,
      question_prompt,
      source,
      next_review_at
    )
    select
      v_user_id,
      p_skill_id,
      v_submission_id,
      q,
      'lab_review'::public.interview_card_source,
      v_submitted_at
    from jsonb_array_elements_text(p_interview_questions) as q;
  end if;

  if p_passed then
    v_progress := public.complete_and_unlock_next_module(p_track_id, p_module_id);
    v_unlocked_id := (v_progress ->> 'unlockedModuleId')::uuid;
    v_track_completed := coalesce((v_progress ->> 'trackCompleted')::boolean, false);
  end if;

  update public.skills
  set mastery_score = p_mastery_score,
      status = p_skill_status,
      updated_at = v_submitted_at
  where id = p_skill_id and user_id = v_user_id;

  return jsonb_build_object(
    'submissionId', v_submission_id,
    'submittedAt', v_submitted_at,
    'unlockedModuleId', v_unlocked_id,
    'trackCompleted', v_track_completed
  );
end;
$$;
