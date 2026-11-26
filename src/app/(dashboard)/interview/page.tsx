import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SpacedRepetitionQueue } from "@/components/interview/SpacedRepetitionQueue";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

async function InterviewLabLoader() {
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
  const [cardsRes, skillsRes, attemptsRes] = await Promise.all([
    supabase
      .from("interview_cards")
      .select(
        "id, skill_id, question_prompt, source, confidence_level, review_count, next_review_at",
      )
      .eq("user_id", user.id)
      .order("next_review_at", { ascending: true }),
    supabase
      .from("skills")
      .select("id, name, status, mastery_score")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("interview_attempts")
      .select(
        "id, card_id, skill_id, user_notes, duration_seconds, confidence_level, attempted_at",
      )
      .eq("user_id", user.id)
      .order("attempted_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <SpacedRepetitionQueue
      cards={cardsRes.data ?? []}
      skills={skillsRes.data ?? []}
      attempts={attemptsRes.data ?? []}
      serverNowIso={new Date().toISOString()}
    />
  );
}

export default function InterviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview Lab"
        description="Latih komunikasi teknis dengan timer 2 menit, kerangka 3 poin, dan pengulangan berkala aktif."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat antrean Kartu Interview...
          </div>
        }
      >
        <InterviewLabLoader />
      </Suspense>
    </div>
  );
}
