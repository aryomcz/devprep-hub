import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SkillTable, type SkillRow } from "@/components/skills/SkillTable";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { calculateMasteryBreakdown } from "@/lib/mastery";
import { createClient } from "@/lib/supabase/server";
import type { ConfidenceLevel } from "@/types/database";

async function SkillsContent() {
  let user: { id: string; email: string };
  try {
    user = await requireAllowedUser();
  } catch (error) {
    if (error instanceof AuthGuardError && error.status === 403) {
      redirect("/login?error=forbidden");
    }
    redirect("/login");
  }

  const supabase = await createClient();

  const [skillsRes, quizzesRes, labsRes, interviewsRes, profileRes] =
    await Promise.all([
      supabase
        .from("skills")
        .select(
          "id, name, slug, category, status, mastery_score, source, updated_at",
        )
        .eq("user_id", user.id)
        .order("mastery_score", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("quiz_attempts")
        .select("skill_id, score")
        .eq("user_id", user.id)
        .order("attempted_at", { ascending: false }),
      supabase
        .from("lab_submissions")
        .select("passed, track_modules(skill_id)")
        .eq("user_id", user.id),
      supabase
        .from("interview_attempts")
        .select("skill_id, confidence_level")
        .eq("user_id", user.id)
        .order("attempted_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("github_username, last_github_sync")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const quizMap = new Map<string, number[]>();
  for (const row of quizzesRes.data ?? []) {
    const scores = quizMap.get(row.skill_id);
    if (!scores) {
      quizMap.set(row.skill_id, [row.score]);
    } else if (scores.length < 3) {
      scores.push(row.score);
    }
  }

  const labMap = new Map<string, { submitted: boolean; passed: boolean }>();
  for (const row of labsRes.data ?? []) {
    const relation = row.track_modules;
    const skillId = Array.isArray(relation)
      ? relation[0]?.skill_id
      : relation?.skill_id;
    if (!skillId) continue;

    const current = labMap.get(skillId) ?? { submitted: false, passed: false };
    labMap.set(skillId, {
      submitted: true,
      passed: current.passed || row.passed,
    });
  }

  const interviewMap = new Map<string, ConfidenceLevel>();
  for (const row of interviewsRes.data ?? []) {
    if (!interviewMap.has(row.skill_id)) {
      interviewMap.set(row.skill_id, row.confidence_level);
    }
  }

  const rows: SkillRow[] = (skillsRes.data ?? []).map((skill) => {
    const lab = labMap.get(skill.id);
    const computed = calculateMasteryBreakdown({
      source: skill.source,
      quizScores: quizMap.get(skill.id) ?? [],
      labPassed: lab?.passed ?? false,
      labSubmitted: lab?.submitted ?? false,
      latestConfidence: interviewMap.get(skill.id) ?? null,
    });

    return {
      ...skill,
      breakdown: computed.breakdown,
      capped: computed.capped,
      computedScore: computed.masteryScore,
    };
  });

  return (
    <SkillTable
      skills={rows}
      initialGithubUsername={profileRes.data?.github_username ?? ""}
      lastGithubSync={profileRes.data?.last_github_sync ?? null}
    />
  );
}

export default function SkillsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Skills"
        description="Direktori kanonik keahlian teknis, skor mastery dinamis (Q/L/I), override manual, dan merge duplikat."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat daftar skill...
          </div>
        }
      >
        <SkillsContent />
      </Suspense>
    </div>
  );
}
