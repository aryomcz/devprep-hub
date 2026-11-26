import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import {
  describeFetchError,
  GeminiApiError,
  GeminiRateLimitError,
} from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeInternshipInput,
  MAX_RAW_JD_CHARS,
} from "@/services/ai/jd-analyzer";
import { internshipAnalyzeInputSchema } from "@/types/schemas";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAllowedUser();
    const rawBody: unknown = await request.json().catch(() => null);

    if (
      rawBody &&
      typeof rawBody === "object" &&
      "mode" in rawBody &&
      rawBody.mode === "raw_jd" &&
      "raw_input" in rawBody &&
      typeof rawBody.raw_input === "string" &&
      rawBody.raw_input.length > MAX_RAW_JD_CHARS
    ) {
      return NextResponse.json(
        {
          error: `Teks JD melebihi batas maksimum ${MAX_RAW_JD_CHARS.toLocaleString("id-ID")} karakter.`,
        },
        { status: 400 },
      );
    }

    const parsed = internshipAnalyzeInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Input analisis lowongan tidak valid.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    await supabase
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

    const { data: existingSkills, error: skillsError } = await supabase
      .from("skills")
      .select("slug, name, category")
      .eq("user_id", user.id);

    if (skillsError) {
      return NextResponse.json({ error: skillsError.message }, { status: 500 });
    }

    // ADR-006: JD analysis runs strictly without Hybrid Sourcing.
    const analysis = await analyzeInternshipInput(
      parsed.data,
      existingSkills ?? [],
    );

    const { data: internshipId, error: rpcError } = await supabase.rpc(
      "save_internship_analysis",
      {
        p_title: analysis.title,
        p_company_name: analysis.company_name,
        p_industry: analysis.industry,
        p_raw_input: analysis.raw_input,
        p_jargon_glossary: analysis.jargon_glossary,
        p_skills: analysis.skills,
      },
    );

    if (rpcError || !internshipId) {
      return NextResponse.json(
        {
          error:
            rpcError?.message ?? "Gagal menyimpan hasil analisis lowongan.",
        },
        { status: 500 },
      );
    }

    revalidatePath("/internships");
    revalidatePath("/skills");
    revalidatePath("/dashboard");

    return NextResponse.json(
      {
        ok: true,
        internshipId,
        skillsCount: analysis.skills.length,
        jargonCount: analysis.jargon_glossary.length,
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
    console.error("[/api/internships/analyze]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? describeFetchError(error)
            : "Gagal menganalisis lowongan magang.",
      },
      { status: 500 },
    );
  }
}
