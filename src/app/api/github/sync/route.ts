import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
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

    const { data: syncSummary, error: rpcError } = await supabase.rpc(
      "sync_github_skills",
      {
        p_github_username: username,
        p_skills: detectedSkills.map((skill) => ({
          name: skill.canonicalName,
          slug: skill.slug,
          category: skill.category,
        })),
      },
    );

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const counts = (syncSummary ?? {}) as {
      addedCount?: number;
      upgradedCount?: number;
    };
    const now = new Date().toISOString();

    revalidatePath("/skills");
    revalidatePath("/dashboard");

    return NextResponse.json({
      ok: true,
      githubUsername: username,
      lastGithubSync: now,
      scannedRepos,
      addedCount: counts.addedCount ?? 0,
      upgradedCount: counts.upgradedCount ?? 0,
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
