import { ArrowLeft, Building2, Rocket } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { JargonList } from "@/components/internships/JargonList";
import { InternshipDetailActions } from "@/components/internships/ReadinessCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { calculateReadinessMeter } from "@/lib/mastery";
import { createClient } from "@/lib/supabase/server";
import type { SkillStatus } from "@/types/database";
import { jargonGlossarySchema } from "@/types/schemas";

const SKILL_STATUS_LABELS: Record<SkillStatus, string> = {
  gap: "Gap",
  learning: "Learning",
  mastered: "Mastered",
};

async function InternshipDetailLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

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
  const [internshipRes, linksRes, skillsRes] = await Promise.all([
    supabase
      .from("target_internships")
      .select(
        "id, title, company_name, industry, raw_input, jargon_glossary, status, created_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("internship_skills")
      .select("skill_id, priority")
      .eq("internship_id", id),
    supabase
      .from("skills")
      .select("id, name, slug, category, status, mastery_score")
      .eq("user_id", user.id),
  ]);

  const internship = internshipRes.data;
  if (!internship) {
    notFound();
  }

  const skillById = new Map(
    (skillsRes.data ?? []).map((skill) => [skill.id, skill]),
  );

  const mappedSkills = (linksRes.data ?? [])
    .map((link) => {
      const skill = skillById.get(link.skill_id);
      if (!skill) return null;
      return {
        ...skill,
        priority: link.priority,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const mustHaveSkills = mappedSkills.filter(
    (skill) => skill.priority === "must_have",
  );
  const niceToHaveSkills = mappedSkills.filter(
    (skill) => skill.priority === "nice_to_have",
  );

  const readinessScore = calculateReadinessMeter(
    mappedSkills.map((skill) => ({
      masteryScore: skill.mastery_score,
      priority: skill.priority,
    })),
  );

  const parsedJargon = jargonGlossarySchema.safeParse(
    internship.jargon_glossary,
  );
  const jargonEntries = parsedJargon.success ? parsedJargon.data : [];
  const defaultSkillId =
    mustHaveSkills[0]?.id ?? niceToHaveSkills[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/internships">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            <span>Kembali ke Target Magang</span>
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <InternshipDetailActions
            internshipId={internship.id}
            status={internship.status}
          />
          <Link href={`/tracks?internshipId=${internship.id}`}>
            <Button size="sm" className="gap-1.5">
              <Rocket className="size-4" />
              <span>Generate Capstone Track</span>
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl">{internship.title}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
                <Building2 className="size-3.5" />
                <span>{internship.company_name || "Perusahaan Umum"}</span>
                {internship.industry ? (
                  <Badge variant="outline">{internship.industry}</Badge>
                ) : null}
              </CardDescription>
            </div>
            <Badge
              variant={
                readinessScore >= 80
                  ? "mastered"
                  : readinessScore >= 30
                    ? "learning"
                    : "gap"
              }
              className="px-2.5 py-1 font-mono text-xs tabular-nums"
            >
              Readiness Meter: {readinessScore}%
            </Badge>
          </div>
          <Progress value={readinessScore} className="w-full" />
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Must-Have Skills</span>
              <Badge variant="mono" className="tabular-nums">
                {mustHaveSkills.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Bobot <span className="font-mono">2x</span> pada kalkulasi
              Readiness Meter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mustHaveSkills.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/25 p-5 text-center text-sm text-muted-foreground">
                Tidak ada skill must-have terpetakan.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {mustHaveSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/25"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {skill.name}
                      </span>
                      <Badge variant="mono" className="text-[10px]">
                        {skill.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Badge variant={skill.status}>
                        {SKILL_STATUS_LABELS[skill.status]}
                      </Badge>
                      <Progress value={skill.mastery_score} className="w-16" />
                      <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {skill.mastery_score}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Nice-to-Have Skills</span>
              <Badge variant="mono" className="tabular-nums">
                {niceToHaveSkills.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Bobot <span className="font-mono">1x</span> pada kalkulasi
              Readiness Meter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {niceToHaveSkills.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/25 p-5 text-center text-sm text-muted-foreground">
                Tidak ada skill nice-to-have terpetakan.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {niceToHaveSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/25"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {skill.name}
                      </span>
                      <Badge variant="mono" className="text-[10px]">
                        {skill.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Badge variant={skill.status}>
                        {SKILL_STATUS_LABELS[skill.status]}
                      </Badge>
                      <Progress value={skill.mastery_score} className="w-16" />
                      <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {skill.mastery_score}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <JargonList
        internshipTitle={internship.title}
        companyName={internship.company_name}
        entries={jargonEntries}
        defaultSkillId={defaultSkillId}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Input Referensi Lowongan</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            {internship.raw_input}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InternshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Detail Target Magang"
        description="Matriks hard skill terpetakan, Readiness Meter, dan Glosarium istilah JD."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat detail target magang...
          </div>
        }
      >
        <InternshipDetailLoader params={params} />
      </Suspense>
    </div>
  );
}
