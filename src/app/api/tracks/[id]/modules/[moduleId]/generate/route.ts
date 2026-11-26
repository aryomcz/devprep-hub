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
import { generateModuleContent } from "@/services/ai/module-generator";
import {
  getOrFetchCuratedResources,
  type CachedCuratedResource,
  type CuratedResourceStoreAdapter,
} from "@/services/external/hybrid-sourcing";

export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; moduleId: string }> },
) {
  const { id, moduleId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(moduleId).success) {
    return NextResponse.json(
      { error: "ID track atau modul tidak valid." },
      { status: 400 },
    );
  }

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let shouldMarkFailed = false;

  try {
    const user = await requireAllowedUser();
    supabase = await createClient();

    const [trackRes, moduleRes] = await Promise.all([
      supabase
        .from("learning_tracks")
        .select(
          "id, capstone_title, capstone_description, primary_stack, architecture_overview",
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("track_modules")
        .select(
          "id, track_id, skill_id, order_index, module_type, target_language, objective, content_status, concept_brief, warmup_drills, hands_on_ticket",
        )
        .eq("id", moduleId)
        .eq("track_id", id)
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

    const track = trackRes.data;
    const mod = moduleRes.data;
    if (!track || !mod) {
      return NextResponse.json(
        { error: "Track atau modul tidak ditemukan." },
        { status: 404 },
      );
    }

    const { data: skill, error: skillError } = await supabase
      .from("skills")
      .select("id, name, slug, category")
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

    const client = supabase;
    const storeAdapter: CuratedResourceStoreAdapter = {
      async getBySkillId(skillId) {
        const { data } = await client
          .from("curated_resources")
          .select("id, skill_id, source, title, url, summary, fetched_at")
          .eq("skill_id", skillId)
          .order("fetched_at", { ascending: false });
        return (data ?? []) as CachedCuratedResource[];
      },
      async upsertForSkill(skillId, items) {
        const rows = items.map((item) => ({
          skill_id: skillId,
          source: item.source,
          title: item.title,
          url: item.url,
          summary: item.summary,
          fetched_at: item.fetched_at,
        }));

        const { data, error } = await client
          .from("curated_resources")
          .upsert(rows, { onConflict: "skill_id,url" })
          .select("id, skill_id, source, title, url, summary, fetched_at");

        if (error) {
          throw new Error(error.message);
        }
        return (data ?? []) as CachedCuratedResource[];
      },
    };

    // ADR-006 Idempotency: return cached module JSONB immediately if already ready.
    if (
      mod.content_status === "ready" &&
      mod.concept_brief &&
      mod.warmup_drills &&
      mod.hands_on_ticket
    ) {
      const curatedResources = await storeAdapter.getBySkillId(skill.id);
      return NextResponse.json({
        ok: true,
        cached: true,
        content_status: "ready",
        concept_brief: mod.concept_brief,
        warmup_drills: mod.warmup_drills,
        hands_on_ticket: mod.hands_on_ticket,
        curated_resources: curatedResources,
      });
    }

    shouldMarkFailed = true;

    const curatedResources = await getOrFetchCuratedResources(
      {
        skillId: skill.id,
        skillName: skill.name,
        skillSlug: skill.slug,
      },
      storeAdapter,
    );

    const generated = await generateModuleContent({
      capstoneTitle: track.capstone_title,
      capstoneDescription: track.capstone_description,
      primaryStack: track.primary_stack,
      architectureOverview: track.architecture_overview,
      skillName: skill.name,
      skillCategory: skill.category,
      moduleType: mod.module_type,
      targetLanguage: mod.target_language,
      objective: mod.objective,
      curatedResources: curatedResources.map((r) => ({
        source: r.source,
        title: r.title,
        url: r.url,
        summary: r.summary,
      })),
    });

    const { error: updateError } = await supabase
      .from("track_modules")
      .update({
        content_status: "ready",
        concept_brief: generated.concept_brief,
        warmup_drills: generated.warmup_drills,
        hands_on_ticket: generated.hands_on_ticket,
      })
      .eq("id", moduleId)
      .eq("track_id", id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    shouldMarkFailed = false;
    revalidatePath(`/tracks/${id}`);
    revalidatePath(`/tracks/${id}/modules/${moduleId}`);

    return NextResponse.json({
      ok: true,
      cached: false,
      content_status: "ready",
      ...generated,
      curated_resources: curatedResources,
    });
  } catch (error) {
    if (shouldMarkFailed && supabase) {
      await supabase
        .from("track_modules")
        .update({ content_status: "failed" })
        .eq("id", moduleId)
        .eq("track_id", id);

      revalidatePath(`/tracks/${id}`);
      revalidatePath(`/tracks/${id}/modules/${moduleId}`);
    }

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
    console.error("[/api/tracks/.../generate]", error);
    return NextResponse.json(
      { error: describeFetchError(error) },
      { status: 500 },
    );
  }
}
