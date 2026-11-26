import { NextResponse, type NextRequest } from "next/server";
import { verifyCronSecret } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/server";
import {
  curateDailyDigestForUser,
  type DigestSkillTarget,
} from "@/services/external/daily-digest";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: skillRows, error: skillsError } = await supabase
    .from("skills")
    .select("user_id, id, name, slug, status")
    .in("status", ["gap", "learning"]);

  if (skillsError) {
    return NextResponse.json(
      { error: "Gagal membaca daftar skill target." },
      { status: 500 },
    );
  }

  const skillsByUser = new Map<string, DigestSkillTarget[]>();
  for (const row of skillRows ?? []) {
    const list = skillsByUser.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
    });
    skillsByUser.set(row.user_id, list);
  }

  const digestDate = new Date().toISOString().slice(0, 10);
  let insertedCount = 0;

  for (const [userId, userSkills] of skillsByUser.entries()) {
    const curated = await curateDailyDigestForUser(userSkills);
    if (curated.length === 0) continue;

    const payload = curated.map((entry) => ({
      user_id: userId,
      source: entry.source,
      external_id: entry.external_id,
      title: entry.title,
      url: entry.url,
      tags: entry.tags,
      matched_skill_id: entry.matched_skill_id,
      digest_date: digestDate,
    }));

    const { data: upsertedRows, error: upsertError } = await supabase
      .from("daily_digests")
      .upsert(payload, {
        onConflict: "user_id,source,external_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (upsertError) {
      return NextResponse.json(
        { error: "Gagal menyimpan daily digest." },
        { status: 500 },
      );
    }

    insertedCount += upsertedRows?.length ?? 0;
  }

  return NextResponse.json({
    ok: true,
    digestDate,
    usersProcessed: skillsByUser.size,
    entriesProcessed: insertedCount,
  });
}
