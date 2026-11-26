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
      .select("id, name, status")
      .eq("id", parsed.skillId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (skillError) {
      return { ok: false, error: "Gagal membaca data skill." };
    }
    if (!skill) {
      return { ok: false, error: "Skill tidak ditemukan." };
    }
    if (parsed.source === "skill_gap" && skill.status !== "gap") {
      return {
        ok: false,
        error: "Kartu Skill Gap hanya dapat dibuat untuk skill berstatus Gap.",
      };
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
      .select("id, skill_id")
      .eq("id", parsed.cardId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (cardError) {
      return { ok: false, error: "Gagal membaca Kartu Interview." };
    }
    if (!card) {
      return { ok: false, error: "Kartu Interview tidak ditemukan." };
    }

    const [skillRes, quizzesRes, labsRes] = await Promise.all([
      supabase
        .from("skills")
        .select("id, source")
        .eq("id", card.skill_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("quiz_attempts")
        .select("score")
        .eq("user_id", user.id)
        .eq("skill_id", card.skill_id)
        .order("attempted_at", { ascending: false })
        .limit(3),
      supabase
        .from("lab_submissions")
        .select("passed, track_modules!inner(skill_id)")
        .eq("user_id", user.id)
        .eq("track_modules.skill_id", card.skill_id),
    ]);

    if (skillRes.error || !skillRes.data) {
      return { ok: false, error: "Skill terkait kartu tidak ditemukan." };
    }
    if (quizzesRes.error || labsRes.error) {
      return { ok: false, error: "Gagal membaca sinyal Mastery Score." };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nextReviewAt = calculateNextReview(
      parsed.confidenceLevel,
      now,
    ).toISOString();

    const quizScores = (quizzesRes.data ?? []).map((row) => row.score);
    const labRows = labsRes.data ?? [];
    const breakdown = calculateMasteryBreakdown({
      source: skillRes.data.source,
      quizScores,
      labPassed: labRows.some((row) => row.passed),
      labSubmitted: labRows.length > 0,
      latestConfidence: parsed.confidenceLevel,
    });

    const { error: rpcError } = await supabase.rpc("submit_interview_attempt", {
      p_card_id: card.id,
      p_user_notes: parsed.userNotes,
      p_duration_seconds: parsed.durationSeconds,
      p_confidence_level: parsed.confidenceLevel,
      p_attempted_at: nowIso,
      p_next_review_at: nextReviewAt,
      p_mastery_score: breakdown.masteryScore,
      p_skill_status: breakdown.status,
    });

    if (rpcError) {
      return { ok: false, error: "Gagal menyimpan sesi wawancara." };
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
