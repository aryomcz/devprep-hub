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
    codeSnippet: z
      .string()
      .max(50_000, "Potongan kode melebihi batas 50.000 karakter.")
      .optional()
      .default(""),
    repoCommitUrl: z.string().trim().max(500).optional().default(""),
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
          "id, track_id, skill_id, order_index, target_language, objective, hands_on_ticket, content_status, status",
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

    if (mod.status === "locked") {
      return NextResponse.json(
        {
          error:
            "Modul masih terkunci. Selesaikan modul sebelumnya terlebih dahulu.",
        },
        { status: 403 },
      );
    }

    if (mod.content_status !== "ready") {
      return NextResponse.json(
        {
          error:
            "Materi & Acceptance Criteria modul belum siap. Buka tab Concept Brief terlebih dahulu.",
        },
        { status: 400 },
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
      skippedFiles: sanitized.skippedFiles,
    });

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
      return NextResponse.json(
        { error: "Gagal menghitung sinyal Mastery Score skill." },
        { status: 500 },
      );
    }

    const quizScores = (quizzesRes.data ?? []).map((row) => row.score);
    const labRows = labsRes.data ?? [];
    const breakdown = calculateMasteryBreakdown({
      source: skill.source,
      quizScores,
      labPassed: review.passed || labRows.some((row) => row.passed),
      labSubmitted: true,
      latestConfidence: interviewsRes.data?.[0]?.confidence_level ?? null,
    });

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "submit_lab_review",
      {
        p_track_id: trackId,
        p_module_id: moduleId,
        p_skill_id: skill.id,
        p_code_snippet: repoCommitUrl ? "" : sanitized.sanitizedText,
        p_repo_commit_url: repoCommitUrl,
        p_ai_review_feedback: review.feedback,
        p_interview_questions: review.interview_questions,
        p_passed: review.passed,
        p_mastery_score: breakdown.masteryScore,
        p_skill_status: breakdown.status,
      },
    );

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message ?? "Gagal menyimpan hasil Lab Submission." },
        { status: 500 },
      );
    }

    const rpcResult = (rpcData ?? {}) as {
      submissionId?: string;
      submittedAt?: string;
      unlockedModuleId?: string | null;
    };

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
        submissionId: rpcResult.submissionId ?? "",
        submittedAt: rpcResult.submittedAt ?? new Date().toISOString(),
        passed: review.passed,
        feedback: review.feedback,
        interviewQuestions: review.interview_questions,
        unlockedModuleId: rpcResult.unlockedModuleId ?? null,
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
