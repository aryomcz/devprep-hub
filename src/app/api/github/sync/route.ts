import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { deriveSkillStatus } from "@/lib/mastery";
import { createClient } from "@/lib/supabase/server";
import {
  fetchUserGithubSkills,
  GithubSyncError,
} from "@/services/external/github";

const syncBodySchema = z.object({
  githubUsername: z.string().trim().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAllowedUser();
    const rawBody = await request.json().catch(() => ({}));
    const parsed = syncBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Payload tidak valid." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    let username = parsed.data.githubUsername?.trim() ?? "";

    if (!username) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("github_username")
        .eq("id", user.id)
        .maybeSingle();
      username = profile?.github_username?.trim() ?? "";
    }

    if (!username) {
      return NextResponse.json(
        { error: "Username GitHub wajib diisi." },
        { status: 400 },
      );
    }

    const { skills: detectedSkills, scannedRepos } = await fetchUserGithubSkills(
      username,
      { token: process.env.GITHUB_TOKEN },
    );

    const { data: existingSkills, error: fetchError } = await supabase
      .from("skills")
      .select("id, slug, mastery_score")
      .eq("user_id", user.id);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingMap = new Map(
      (existingSkills ?? []).map((skill) => [skill.slug, skill]),
    );
    const now = new Date().toISOString();
    const baselineScore = 40;
    const baselineStatus = deriveSkillStatus(baselineScore);

    const toInsert = detectedSkills
      .filter((skill) => !existingMap.has(skill.slug))
      .map((skill) => ({
        user_id: user.id,
        name: skill.canonicalName,
        slug: skill.slug,
        category: skill.category,
        source: "github" as const,
        mastery_score: baselineScore,
        status: baselineStatus,
        updated_at: now,
      }));

    const toUpgradeIds = detectedSkills
      .map((skill) => existingMap.get(skill.slug))
      .filter(
        (existing): existing is NonNullable<typeof existing> =>
          existing !== undefined && existing.mastery_score < baselineScore,
      )
      .map((existing) => existing.id);

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("skills")
        .insert(toInsert);
      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 },
        );
      }
    }

    if (toUpgradeIds.length > 0) {
      const { error: upgradeError } = await supabase
        .from("skills")
        .update({
          mastery_score: baselineScore,
          status: baselineStatus,
          updated_at: now,
        })
        .in("id", toUpgradeIds)
        .eq("user_id", user.id);
      if (upgradeError) {
        return NextResponse.json(
          { error: upgradeError.message },
          { status: 500 },
        );
      }
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          github_username: username,
          last_github_sync: now,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    revalidatePath("/skills");
    revalidatePath("/dashboard");

    return NextResponse.json({
      ok: true,
      githubUsername: username,
      lastGithubSync: now,
      scannedRepos,
      addedCount: toInsert.length,
      upgradedCount: toUpgradeIds.length,
      totalDetected: detectedSkills.length,
    });
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
    return NextResponse.json(
      { error: "Gagal menyinkronkan repositori GitHub." },
      { status: 500 },
    );
  }
}
