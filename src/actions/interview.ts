"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { calculateMasteryBreakdown } from "@/lib/mastery";
import { calculateNextReview } from "@/lib/spaced-repetition";
import { createClient } from "@/lib/supabase/server";
import type { SkillStatus } from "@/types/database";
import { confidenceLevelSchema } from "@/types/schemas";

export type InterviewActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const createInterviewCardSchema = z
  .object({
    skillId: z.uuid("ID skill tidak valid."),
    source: z.enum(["manual", "skill_gap"]).optional().default("manual"),
    questionPrompt: z.string().trim().max(2000).optional().default(""),
  })
  .refine(
    (data) =>
      data.source !== "manual" || data.questionPrompt.trim().length > 0,
    {
      message: "Pertanyaan wawancara wajib diisi untuk kartu manual.",
    },
  );

const submitInterviewAttemptSchema = z.object({
  cardId: z.uuid("ID kartu tidak valid."),
  durationSeconds: z.number().int().min(0).max(3600),
  userNotes: z.string().trim().max(10_000).optional().default(""),
  confidenceLevel: confidenceLevelSchema,
});

function getErrorMessage(error: unknown): string {
  if (error instanceof AuthGuardError) {
    return error.status === 401
      ? "Sesi berakhir. Silakan login kembali."
      : "Akses ditolak oleh Single-User Gate.";
  }
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Input sesi wawancara tidak valid.";
  }
  return "Terjadi kesalahan saat memproses Interview Lab.";
}

export async function createInterviewCardAction(
  input: z.input<typeof createInterviewCardSchema>,
): Promise<InterviewActionResult<{ cardId: string }>> {
  try {
    const user = await requireAllowedUser();
    const parsed = createInterviewCardSchema.parse(input);
    const supabase = await createClient();

    const { data: skill, error: skillError } = await supabase
      .from("skills")
      .select("id, name")
      .eq("id", parsed.skillId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (skillError) {
      return { ok: false, error: "Gagal membaca data skill." };
    }
    if (!skill) {
      return { ok: false, error: "Skill tidak ditemukan." };
    }

    const questionPrompt =
      parsed.questionPrompt.trim() ||
      `Jelaskan konsep inti ${skill.name}, masalah rekayasa yang diselesaikannya, dan trade-off implementasinya.`;

    const { data: inserted, error: insertError } = await supabase
      .from("interview_cards")
      .insert({
        user_id: user.id,
        skill_id: skill.id,
        question_prompt: questionPrompt,
        source: parsed.source,
        next_review_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return { ok: false, error: "Gagal membuat Kartu Interview." };
    }

    revalidatePath("/interview");
    revalidatePath("/dashboard");
    return { ok: true, data: { cardId: inserted.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitInterviewAttemptAction(
  input: z.input<typeof submitInterviewAttemptSchema>,
): Promise<
  InterviewActionResult<{
    nextReviewAt: string;
    masteryScore: number;
    skillStatus: SkillStatus;
    capped: boolean;
  }>
> {
  try {
    const user = await requireAllowedUser();
    const parsed = submitInterviewAttemptSchema.parse(input);
    const supabase = await createClient();

    const { data: card, error: cardError } = await supabase
      .from("interview_cards")
      .select("id, skill_id, review_count")
      .eq("id", parsed.cardId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (cardError) {
      return { ok: false, error: "Gagal membaca Kartu Interview." };
    }
    if (!card) {
      return { ok: false, error: "Kartu Interview tidak ditemukan." };
    }

    const { data: skill, error: skillError } = await supabase
      .from("skills")
      .select("id, source")
      .eq("id", card.skill_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (skillError || !skill) {
      return { ok: false, error: "Skill terkait kartu tidak ditemukan." };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nextReviewAt = calculateNextReview(
      parsed.confidenceLevel,
      now,
    ).toISOString();

    const { data: attempt, error: attemptError } = await supabase
      .from("interview_attempts")
      .insert({
        card_id: card.id,
        user_id: user.id,
        skill_id: skill.id,
        user_notes: parsed.userNotes,
        duration_seconds: parsed.durationSeconds,
        confidence_level: parsed.confidenceLevel,
        attempted_at: nowIso,
      })
      .select("id")
      .single();

    if (attemptError || !attempt) {
      return { ok: false, error: "Gagal menyimpan riwayat sesi wawancara." };
    }

    const { error: cardUpdateError } = await supabase
      .from("interview_cards")
      .update({
        confidence_level: parsed.confidenceLevel,
        review_count: card.review_count + 1,
        next_review_at: nextReviewAt,
        updated_at: nowIso,
      })
      .eq("id", card.id)
      .eq("user_id", user.id);

    if (cardUpdateError) {
      await supabase
        .from("interview_attempts")
        .delete()
        .eq("id", attempt.id)
        .eq("user_id", user.id);
      return { ok: false, error: "Gagal memperbarui jadwal review kartu." };
    }

    const [quizzesRes, labsRes, interviewsRes] = await Promise.all([
      supabase
        .from("quiz_attempts")
        .select("score")
        .eq("user_id", user.id)
        .eq("skill_id", skill.id)
        .order("attempted_at", { ascending: false })
        .limit(3),
      supabase
        .from("lab_submissions")
        .select("passed, track_modules!inner(skill_id)")
        .eq("user_id", user.id)
        .eq("track_modules.skill_id", skill.id),
      supabase
        .from("interview_attempts")
        .select("confidence_level")
        .eq("user_id", user.id)
        .eq("skill_id", skill.id)
        .order("attempted_at", { ascending: false })
        .limit(1),
    ]);

    const signalError =
      quizzesRes.error ?? labsRes.error ?? interviewsRes.error;
    if (signalError) {
      return { ok: false, error: "Gagal membaca sinyal Mastery Score." };
    }

    const quizScores = (quizzesRes.data ?? []).map((row) => row.score);
    const labRows = labsRes.data ?? [];
    const breakdown = calculateMasteryBreakdown({
      source: skill.source,
      quizScores,
      labPassed: labRows.some((row) => row.passed),
      labSubmitted: labRows.length > 0,
      latestConfidence:
        interviewsRes.data?.[0]?.confidence_level ?? parsed.confidenceLevel,
    });

    const { error: skillUpdateError } = await supabase
      .from("skills")
      .update({
        mastery_score: breakdown.masteryScore,
        status: breakdown.status,
        updated_at: nowIso,
      })
      .eq("id", skill.id)
      .eq("user_id", user.id);

    if (skillUpdateError) {
      return { ok: false, error: "Gagal memperbarui Mastery Score skill." };
    }

    revalidatePath("/interview");
    revalidatePath("/dashboard");
    revalidatePath("/skills");
    revalidatePath("/internships");

    return {
      ok: true,
      data: {
        nextReviewAt,
        masteryScore: breakdown.masteryScore,
        skillStatus: breakdown.status,
        capped: breakdown.capped,
      },
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
