import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  InternshipsDirectory,
  type InternshipSkillReadiness,
  type InternshipSummaryItem,
} from "@/components/internships/ReadinessCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

async function InternshipsLoader() {
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
  const [internshipsRes, linksRes, skillsRes] = await Promise.all([
    supabase
      .from("target_internships")
      .select("id, title, company_name, industry, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("internship_skills")
      .select("internship_id, skill_id, priority"),
    supabase
      .from("skills")
      .select("id, name, mastery_score")
      .eq("user_id", user.id),
  ]);

  const skillById = new Map(
    (skillsRes.data ?? []).map((skill) => [skill.id, skill]),
  );
  const skillsByInternship = new Map<string, InternshipSkillReadiness[]>();

  for (const link of linksRes.data ?? []) {
    const skill = skillById.get(link.skill_id);
    if (!skill) continue;

    const list = skillsByInternship.get(link.internship_id) ?? [];
    list.push({
      skillId: skill.id,
      name: skill.name,
      priority: link.priority,
      masteryScore: skill.mastery_score,
    });
    skillsByInternship.set(link.internship_id, list);
  }

  const summaries: InternshipSummaryItem[] = (internshipsRes.data ?? []).map(
    (row) => ({
      ...row,
      skills: skillsByInternship.get(row.id) ?? [],
    }),
  );

  return <InternshipsDirectory internships={summaries} />;
}

export default function InternshipsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Target Magang"
        description="Analisis lowongan, pantau Readiness Meter (2:1), dan kelola status lamaran Anda."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat daftar target magang...
          </div>
        }
      >
        <InternshipsLoader />
      </Suspense>
    </div>
  );
}
