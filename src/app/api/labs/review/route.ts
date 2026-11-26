import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { sanitizeCodeOrDiff } from "@/lib/diff-sanitizer";
import {
  describeFetchError,
  GeminiApiError,
  GeminiRateLimitError,
} from "@/lib/gemini";
import { calculateMasteryBreakdown } from "@/lib/mastery";
import { createClient } from "@/lib/supabase/server";
import { reviewLabSubmission } from "@/services/ai/code-reviewer";
import {
  fetchSanitizedCommitDiff,
  GithubSyncError,
} from "@/services/external/github";
import { handsOnTicketSchema } from "@/types/schemas";

export const maxDuration = 30;

const reviewRequestSchema = z
  .object({
    trackId: z.uuid("ID track tidak valid."),
    moduleId: z.uuid("ID modul tidak valid."),
    codeSnippet: z.string().optional().default(""),
    repoCommitUrl: z.string().trim().optional().default(""),
  })
  .refine(
    (data) =>
      data.codeSnippet.trim().length > 0 || data.repoCommitUrl.trim().length > 0,
    {
      message: "Kirimkan potongan kode atau tautan commit GitHub.",
    },
  );

export async function POST(request: NextRequest) {
  try {
    const user = await requireAllowedUser();
    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = reviewRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Payload review praktikum tidak valid.",
        },
        { status: 400 },
      );
    }

    const { trackId, moduleId, codeSnippet, repoCommitUrl } = parsed.data;
    const supabase = await createClient();

    const [trackRes, moduleRes] = await Promise.all([
      supabase
        .from("learning_tracks")
        .select("id")
        .eq("id", trackId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("track_modules")
        .select(
          "id, track_id, skill_id, order_index, target_language, objective, hands_on_ticket, status",
        )
        .eq("id", moduleId)
        .eq("track_id", trackId)
        .maybeSingle(),
    ]);

    if (trackRes.error ?? moduleRes.error) {
      return NextResponse.json(
        {
          error:
            (trackRes.error ?? moduleRes.error)?.message ??
            "Gagal membaca data modul.",
        },
        { status: 500 },
      );
    }

    const mod = moduleRes.data;
    if (!trackRes.data || !mod) {
      return NextResponse.json(
        { error: "Track atau modul tidak ditemukan." },
        { status: 404 },
      );
    }

    const { data: skill, error: skillError } = await supabase
      .from("skills")
      .select("id, name, source")
      .eq("id", mod.skill_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (skillError) {
      return NextResponse.json({ error: skillError.message }, { status: 500 });
    }
    if (!skill) {
      return NextResponse.json(
        { error: "Skill terkait modul tidak ditemukan." },
        { status: 404 },
      );
    }

    const sanitized = repoCommitUrl
      ? await fetchSanitizedCommitDiff(repoCommitUrl, {
          token: process.env.GITHUB_TOKEN,
        })
      : sanitizeCodeOrDiff(codeSnippet);

    if (!sanitized.sanitizedText.trim()) {
      return NextResponse.json(
        {
          error:
            "Tidak ada perubahan kode sumber yang dapat direview (hanya lockfile/binary atau kosong).",
        },
        { status: 400 },
      );
    }

    const parsedTicket = handsOnTicketSchema.safeParse(mod.hands_on_ticket);
    const acceptanceCriteria = parsedTicket.success
      ? parsedTicket.data.acceptance_criteria
      : [];

    const review = await reviewLabSubmission({
      skillName: skill.name,
      targetLanguage: mod.target_language,
      objective: mod.objective,
      acceptanceCriteria,
      submittedCodeOrDiff: sanitized.sanitizedText,
      truncated: sanitized.truncated,
      skippedFiles: sanitized.skippedFiles,
    });

    const { data: submission, error: subError } = await supabase
      .from("lab_submissions")
      .insert({
        module_id: moduleId,
        user_id: user.id,
        code_snippet: repoCommitUrl ? "" : sanitized.sanitizedText,
        repo_commit_url: repoCommitUrl,
        ai_review_feedback: review.feedback,
        generated_interview_qs: review.interview_questions,
        passed: review.passed,
      })
      .select("id, submitted_at")
      .single();

    if (subError || !submission) {
      return NextResponse.json(
        { error: subError?.message ?? "Gagal menyimpan LabSubmission." },
        { status: 500 },
      );
    }

    const nowIso = new Date().toISOString();
    const interviewCardRows = review.interview_questions.map((question) => ({
      user_id: user.id,
      skill_id: skill.id,
      lab_submission_id: submission.id,
      question_prompt: question,
      source: "lab_review" as const,
      next_review_at: nowIso,
    }));

    const { error: cardError } = await supabase
      .from("interview_cards")
      .insert(interviewCardRows);

    if (cardError) {
      return NextResponse.json({ error: cardError.message }, { status: 500 });
    }

    let unlockedModuleId: string | null = null;
    if (review.passed) {
      await supabase
        .from("track_modules")
        .update({ status: "completed" })
        .eq("id", moduleId)
        .eq("track_id", trackId);

      const { data: trackModules } = await supabase
        .from("track_modules")
        .select("id, order_index, status")
        .eq("track_id", trackId)
        .order("order_index", { ascending: true });

      const list = trackModules ?? [];
      const currentIdx = list.findIndex((item) => item.id === moduleId);
      const nextLocked = list.find(
        (item, idx) => idx > currentIdx && item.status === "locked",
      );

      if (nextLocked) {
        await supabase
          .from("track_modules")
          .update({ status: "in_progress" })
          .eq("id", nextLocked.id)
          .eq("track_id", trackId);
        unlockedModuleId = nextLocked.id;
      }

      const allCompleted = list.every(
        (item) => item.id === moduleId || item.status === "completed",
      );
      if (allCompleted) {
        await supabase
          .from("learning_tracks")
          .update({ status: "completed" })
          .eq("id", trackId)
          .eq("user_id", user.id);
      }
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

    const quizScores = (quizzesRes.data ?? []).map((row) => row.score);
    const labRows = labsRes.data ?? [];
    const breakdown = calculateMasteryBreakdown({
      source: skill.source,
      quizScores,
      labPassed: labRows.some((row) => row.passed),
      labSubmitted: labRows.length > 0,
      latestConfidence: interviewsRes.data?.[0]?.confidence_level ?? null,
    });

    await supabase
      .from("skills")
      .update({
        mastery_score: breakdown.masteryScore,
        status: breakdown.status,
        updated_at: nowIso,
      })
      .eq("id", skill.id)
      .eq("user_id", user.id);

    revalidatePath("/tracks");
    revalidatePath(`/tracks/${trackId}`);
    revalidatePath(`/tracks/${trackId}/modules/${moduleId}`);
    revalidatePath("/skills");
    revalidatePath("/interview");
    revalidatePath("/dashboard");
    revalidatePath("/internships");

    return NextResponse.json(
      {
        ok: true,
        submissionId: submission.id,
        submittedAt: submission.submitted_at,
        passed: review.passed,
        feedback: review.feedback,
        interviewQuestions: review.interview_questions,
        unlockedModuleId,
        masteryScore: breakdown.masteryScore,
        skillStatus: breakdown.status,
        capped: breakdown.capped,
        truncated: sanitized.truncated,
        skippedFiles: sanitized.skippedFiles,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof GithubSyncError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof GeminiRateLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "RATE_LIMIT",
          retryAfterMs: error.retryAfterMs ?? null,
        },
        { status: 429 },
      );
    }
    if (error instanceof GeminiApiError) {
      const status =
        error.status >= 400 && error.status < 600 ? error.status : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[/api/labs/review]", error);
    return NextResponse.json(
      { error: describeFetchError(error) },
      { status: 500 },
    );
  }
}
