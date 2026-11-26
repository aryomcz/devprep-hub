import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  MasteryChart,
  type DashboardQuizPoint,
} from "@/components/dashboard/MasteryChart";
import {
  ReadinessOverview,
  type DashboardActiveTrack,
  type DashboardInternshipReadiness,
} from "@/components/dashboard/ReadinessOverview";
import { TodaysFocusCard } from "@/components/dashboard/TodaysFocusCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { calculateReadinessMeter } from "@/lib/mastery";
import { sortDueInterviewCards } from "@/lib/spaced-repetition";
import { createClient } from "@/lib/supabase/server";
import {
  calculateLearningStreak,
  pickTodaysFocus,
} from "@/lib/todays-focus";
import type { SkillPriority } from "@/types/database";

async function DashboardLoader() {
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
  const [
    skillsRes,
    internshipsRes,
    internshipSkillsRes,
    tracksRes,
    modulesRes,
    cardsRes,
    digestsRes,
    quizzesRes,
    labsRes,
    interviewAttemptsRes,
  ] = await Promise.all([
    supabase
      .from("skills")
      .select("id, name, status, mastery_score")
      .eq("user_id", user.id)
      .order("mastery_score", { ascending: false }),
    supabase
      .from("target_internships")
      .select("id, title, company_name, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("internship_skills")
      .select("internship_id, skill_id, priority"),
    supabase
      .from("learning_tracks")
      .select("id, capstone_title, primary_stack, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("track_modules")
      .select("id, track_id, skill_id, order_index, objective, status")
      .order("order_index", { ascending: true }),
    supabase
      .from("interview_cards")
      .select("id, skill_id, question_prompt, next_review_at")
      .eq("user_id", user.id),
    supabase
      .from("daily_digests")
      .select("id, title, source, matched_skill_id, is_read, digest_date")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .order("digest_date", { ascending: false }),
    supabase
      .from("quiz_attempts")
      .select("id, score, attempted_at")
      .eq("user_id", user.id)
      .order("attempted_at", { ascending: false })
      .limit(30),
    supabase
      .from("lab_submissions")
      .select("submitted_at")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(30),
    supabase
      .from("interview_attempts")
      .select("attempted_at")
      .eq("user_id", user.id)
      .order("attempted_at", { ascending: false })
      .limit(30),
  ]);

  const now = new Date();
  const skills = skillsRes.data ?? [];
  const skillMap = new Map(skills.map((s) => [s.id, s]));

  const dueCards = sortDueInterviewCards(cardsRes.data ?? [], now).map(
    (card) => ({
      ...card,
      skillName: skillMap.get(card.skill_id)?.name,
    }),
  );

  const unreadDigests = (digestsRes.data ?? []).map((digest) => ({
    ...digest,
    skillName: digest.matched_skill_id
      ? skillMap.get(digest.matched_skill_id)?.name
      : undefined,
  }));

  const tracks = tracksRes.data ?? [];
  const trackMap = new Map(tracks.map((t) => [t.id, t]));
  const allModules = modulesRes.data ?? [];

  const activeTrackModules = allModules
    .filter((mod) => {
      const parent = trackMap.get(mod.track_id);
      return parent?.status === "active" && mod.status === "in_progress";
    })
    .map((mod) => ({
      ...mod,
      capstoneTitle: trackMap.get(mod.track_id)?.capstone_title,
      skillName: skillMap.get(mod.skill_id)?.name,
    }));

  const focus = pickTodaysFocus({
    dueInterviewCards: dueCards,
    unreadDigests,
    activeTrackModules,
  });

  const linksByInternship = new Map<
    string,
    Array<{ masteryScore: number; priority: SkillPriority }>
  >();
  for (const link of internshipSkillsRes.data ?? []) {
    const skill = skillMap.get(link.skill_id);
    if (!skill) continue;
    const list = linksByInternship.get(link.internship_id) ?? [];
    list.push({ masteryScore: skill.mastery_score, priority: link.priority });
    linksByInternship.set(link.internship_id, list);
  }

  const readinessInternships: DashboardInternshipReadiness[] = (
    internshipsRes.data ?? []
  ).map((item) => ({
    id: item.id,
    title: item.title,
    companyName: item.company_name,
    status: item.status,
    readinessScore: calculateReadinessMeter(
      linksByInternship.get(item.id) ?? [],
    ),
  }));

  const activeTracks: DashboardActiveTrack[] = tracks
    .filter((t) => t.status === "active")
    .slice(0, 3)
    .map((track) => {
      const mods = allModules.filter((m) => m.track_id === track.id);
      return {
        id: track.id,
        capstoneTitle: track.capstone_title,
        primaryStack: track.primary_stack,
        completedModules: mods.filter((m) => m.status === "completed").length,
        totalModules: mods.length,
      };
    });

  const statusCounts = {
    gap: skills.filter((s) => s.status === "gap").length,
    learning: skills.filter((s) => s.status === "learning").length,
    mastered: skills.filter((s) => s.status === "mastered").length,
  };

  const quizzes = quizzesRes.data ?? [];
  const quizPoints: DashboardQuizPoint[] = [...quizzes]
    .slice(0, 8)
    .reverse()
    .map((q) => ({
      id: q.id,
      score: q.score,
      label: new Date(q.attempted_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
    }));

  const activityDates = [
    ...quizzes.map((q) => q.attempted_at),
    ...(labsRes.data ?? []).map((l) => l.submitted_at),
    ...(interviewAttemptsRes.data ?? []).map((i) => i.attempted_at),
  ];
  const learningStreak = calculateLearningStreak(activityDates, now);

  return (
    <div className="space-y-6">
      <TodaysFocusCard
        focus={focus}
        counts={{
          dueInterviews: dueCards.length,
          unreadDigests: unreadDigests.length,
          activeModules: activeTrackModules.length,
        }}
      />

      <ReadinessOverview
        internships={readinessInternships}
        activeTracks={activeTracks}
      />

      <MasteryChart
        skills={skills.slice(0, 8).map((s) => ({
          id: s.id,
          name: s.name,
          masteryScore: s.mastery_score,
          status: s.status,
        }))}
        quizPoints={quizPoints}
        learningStreak={learningStreak}
        statusCounts={statusCounts}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan kesiapan magang, Today's Focus, dan analitik penguasaan skill."
        actions={
          <Link href="/skills">
            <Button size="sm" variant="outline">
              Kelola Master Skills
            </Button>
          </Link>
        }
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat analitik kesiapan Anda...
          </div>
        }
      >
        <DashboardLoader />
      </Suspense>
    </div>
  );
}
