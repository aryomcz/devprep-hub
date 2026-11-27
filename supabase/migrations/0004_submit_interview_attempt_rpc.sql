-- DevPrep Hub — Atomic RPC for InterviewAttempt + InterviewCard + Skill Mastery
-- Complies with ADR-005 (multi-table atomic RPC) and GLOSSARY.md Invariant #7 (append-only interview_attempts).

create or replace function public.submit_interview_attempt(
  p_card_id uuid,
  p_user_notes text,
  p_duration_seconds integer,
  p_confidence_level public.confidence_level,
  p_attempted_at timestamptz,
  p_next_review_at timestamptz,
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
  v_skill_id uuid;
  v_attempt_id uuid;
  v_ts timestamptz := coalesce(p_attempted_at, now());
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select skill_id into v_skill_id
  from public.interview_cards
  where id = p_card_id and user_id = v_user_id
  for update;

  if v_skill_id is null then
    raise exception 'Interview card not found or unauthorized';
  end if;

  insert into public.interview_attempts (
    card_id,
    user_id,
    skill_id,
    user_notes,
    duration_seconds,
    confidence_level,
    attempted_at
  )
  values (
    p_card_id,
    v_user_id,
    v_skill_id,
    coalesce(p_user_notes, ''),
    p_duration_seconds,
    p_confidence_level,
    v_ts
  )
  returning id into v_attempt_id;

  update public.interview_cards
  set confidence_level = p_confidence_level,
      review_count = review_count + 1,
      next_review_at = p_next_review_at,
      updated_at = v_ts
  where id = p_card_id and user_id = v_user_id;

  update public.skills
  set mastery_score = p_mastery_score,
      status = p_skill_status,
      updated_at = v_ts
  where id = v_skill_id and user_id = v_user_id;

  return v_attempt_id;
end;
$$;
