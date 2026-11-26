import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import {
  describeFetchError,
  GeminiApiError,
  GeminiRateLimitError,
} from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";
import {
  generateTrackBlueprint,
  type TrackSkillCandidate,
} from "@/services/ai/track-generator";

export const maxDuration = 30;

const generateTrackRequestSchema = z
  .object({
    internshipId: z.uuid("ID lowongan tidak valid.").nullable().optional(),
    skillIds: z.array(z.uuid("ID skill tidak valid.")).max(15).optional(),
    languageMode: z
      .enum(["microservice", "language_native"])
      .optional()
      .default("microservice"),
  })
  .refine(
    (data) =>
      Boolean(data.internshipId) ||
      (Array.isArray(data.skillIds) && data.skillIds.length > 0),
    {
      message: "Pilih Target Internship atau minimal 1 Skill target.",
    },
  );

export async function POST(request: NextRequest) {
  try {
    const user = await requireAllowedUser();
    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = generateTrackRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Payload pembuatan Learning Track tidak valid.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    await supabase
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

    const { internshipId, skillIds, languageMode } = parsed.data;

    const { data: userSkills, error: skillsError } = await supabase
      .from("skills")
      .select("id, name, slug, category, status")
      .eq("user_id", user.id);

    if (skillsError) {
      return NextResponse.json({ error: skillsError.message }, { status: 500 });
    }

    const skillById = new Map((userSkills ?? []).map((s) => [s.id, s]));
    let selectedCandidates: TrackSkillCandidate[] = [];
    let internshipMeta: {
      title: string;
      company_name: string;
      industry: string;
    } | null = null;

    if (internshipId) {
      const [internshipRes, linksRes] = await Promise.all([
        supabase
          .from("target_internships")
          .select("id, title, company_name, industry")
          .eq("id", internshipId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("internship_skills")
          .select("skill_id, priority")
          .eq("internship_id", internshipId),
      ]);

      if (internshipRes.error) {
        return NextResponse.json(
          { error: internshipRes.error.message },
          { status: 500 },
        );
      }
      if (!internshipRes.data) {
        return NextResponse.json(
          { error: "Target Internship tidak ditemukan." },
          { status: 404 },
        );
      }

      internshipMeta = internshipRes.data;

      const linkedCandidates: TrackSkillCandidate[] = (linksRes.data ?? [])
        .map((link) => {
          const skill = skillById.get(link.skill_id);
          if (!skill) return null;
          return {
            ...skill,
            priority: link.priority,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const gapOrLearning = linkedCandidates.filter(
        (item) => item.status === "gap" || item.status === "learning",
      );
      selectedCandidates =
        gapOrLearning.length > 0 ? gapOrLearning : linkedCandidates;
    }

    if (skillIds && skillIds.length > 0) {
      const explicitCandidates = skillIds
        .map((id) => skillById.get(id))
        .filter((item): item is NonNullable<typeof item> => item !== undefined);

      const seen = new Set(explicitCandidates.map((s) => s.id));
      selectedCandidates = [
        ...explicitCandidates,
        ...selectedCandidates.filter((s) => !seen.has(s.id)),
      ];
    }

    if (selectedCandidates.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada Skill yang tersedia untuk dibuatkan Learning Track.",
        },
        { status: 400 },
      );
    }

    // ADR-006 Stage 1: generate blueprint & skeleton modules only (content_status = 'pending').
    const blueprint = await generateTrackBlueprint({
      internshipTitle: internshipMeta?.title,
      companyName: internshipMeta?.company_name,
      industry: internshipMeta?.industry,
      skills: selectedCandidates,
      languageMode,
    });

    const { data: trackRow, error: trackError } = await supabase
      .from("learning_tracks")
      .insert({
        user_id: user.id,
        internship_id: internshipId ?? null,
        capstone_title: blueprint.capstone_title,
        capstone_description: blueprint.capstone_description,
        primary_stack: blueprint.primary_stack,
        architecture_overview: blueprint.architecture_overview,
        status: "active",
      })
      .select("id")
      .single();

    if (trackError || !trackRow) {
      return NextResponse.json(
        { error: trackError?.message ?? "Gagal menyimpan Learning Track." },
        { status: 500 },
      );
    }

    const moduleRows = blueprint.modules.map((mod, idx) => ({
      track_id: trackRow.id,
      skill_id: mod.skill_id,
      order_index: mod.order_index,
      module_type: mod.module_type,
      target_language: mod.target_language,
      objective: mod.objective,
      content_status: "pending" as const,
      concept_brief: null,
      warmup_drills: null,
      hands_on_ticket: null,
      status: idx === 0 ? ("in_progress" as const) : ("locked" as const),
    }));

    const { error: modulesError } = await supabase
      .from("track_modules")
      .insert(moduleRows);

    if (modulesError) {
      await supabase
        .from("learning_tracks")
        .delete()
        .eq("id", trackRow.id)
        .eq("user_id", user.id);

      return NextResponse.json(
        { error: modulesError.message },
        { status: 500 },
      );
    }

    revalidatePath("/tracks");
    revalidatePath("/dashboard");

    return NextResponse.json(
      {
        ok: true,
        trackId: trackRow.id,
        moduleCount: moduleRows.length,
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
    console.error("[/api/tracks/generate]", error);
    return NextResponse.json(
      { error: describeFetchError(error) },
      { status: 500 },
    );
  }
}
