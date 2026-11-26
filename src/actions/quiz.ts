"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { calculateMasteryBreakdown } from "@/lib/mastery";
import { createClient } from "@/lib/supabase/server";
import type { SkillStatus } from "@/types/database";
import { quizSourceTypeSchema } from "@/types/schemas";

export type QuizActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const submitQuizAttemptSchema = z
  .object({
    skillId: z.uuid("ID skill tidak valid."),
    sourceType: quizSourceTypeSchema,
    totalQuestions: z.number().int().min(1).max(500),
    correctAnswers: z.number().int().min(0),
  })
  .refine((data) => data.correctAnswers <= data.totalQuestions, {
    message: "Jumlah jawaban benar tidak boleh melebihi total soal.",
  });

function getErrorMessage(error: unknown): string {
  if (error instanceof AuthGuardError) {
    return error.status === 401
      ? "Sesi berakhir. Silakan login kembali."
      : "Akses ditolak oleh Single-User Gate.";
  }
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Input kuis tidak valid.";
  }
  return "Terjadi kesalahan saat menyimpan hasil kuis.";
}

export async function submitQuizAttemptAction(
  input: z.input<typeof submitQuizAttemptSchema>,
): Promise<
  QuizActionResult<{
    score: number;
    masteryScore: number;
    status: SkillStatus;
    capped: boolean;
  }>
> {
  try {
    const user = await requireAllowedUser();
    const parsed = submitQuizAttemptSchema.parse(input);
    const supabase = await createClient();

    const [skillRes, quizzesRes, labsRes, interviewsRes] = await Promise.all([
      supabase
        .from("skills")
        .select("id, source")
        .eq("id", parsed.skillId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("quiz_attempts")
        .select("score")
        .eq("user_id", user.id)
        .eq("skill_id", parsed.skillId)
        .order("attempted_at", { ascending: false })
        .limit(2),
      supabase
        .from("lab_submissions")
        .select("passed, track_modules!inner(skill_id)")
        .eq("user_id", user.id)
        .eq("track_modules.skill_id", parsed.skillId),
      supabase
        .from("interview_attempts")
        .select("confidence_level")
        .eq("user_id", user.id)
        .eq("skill_id", parsed.skillId)
        .order("attempted_at", { ascending: false })
        .limit(1),
    ]);

    if (skillRes.error) {
      return { ok: false, error: skillRes.error.message };
    }
    if (!skillRes.data) {
      return { ok: false, error: "Skill terkait tidak ditemukan." };
    }

    const firstError =
      quizzesRes.error ?? labsRes.error ?? interviewsRes.error;
    if (firstError) {
      return { ok: false, error: firstError.message };
    }

    const score = Math.round(
      (parsed.correctAnswers / parsed.totalQuestions) * 100,
    );
    const quizScores = [
      score,
      ...(quizzesRes.data ?? []).map((row) => row.score),
    ].slice(0, 3);
    const labRows = labsRes.data ?? [];
    const labSubmitted = labRows.length > 0;
    const labPassed = labRows.some((row) => row.passed);
    const latestConfidence =
      interviewsRes.data?.[0]?.confidence_level ?? null;

    const breakdown = calculateMasteryBreakdown({
      source: skillRes.data.source,
      quizScores,
      labPassed,
      labSubmitted,
      latestConfidence,
    });

    const { error: rpcError } = await supabase.rpc("submit_quiz_attempt", {
      p_skill_id: parsed.skillId,
      p_source_type: parsed.sourceType,
      p_score: score,
      p_total_questions: parsed.totalQuestions,
      p_correct_answers: parsed.correctAnswers,
      p_mastery_score: breakdown.masteryScore,
      p_skill_status: breakdown.status,
    });

    if (rpcError) {
      return { ok: false, error: rpcError.message };
    }

    revalidatePath("/quiz");
    revalidatePath("/skills");
    revalidatePath("/dashboard");
    revalidatePath("/internships");

    return {
      ok: true,
      data: {
        score,
        masteryScore: breakdown.masteryScore,
        status: breakdown.status,
        capped: breakdown.capped,
      },
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
