import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClozeQuizRunner } from "@/components/quiz/ClozeQuizRunner";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

async function QuizContent({
  searchParams,
}: {
  searchParams: Promise<{ noteId?: string }>;
}) {
  let user: { id: string; email: string };
  try {
    user = await requireAllowedUser();
  } catch (error) {
    if (error instanceof AuthGuardError && error.status === 403) {
      redirect("/login?error=forbidden");
    }
    redirect("/login");
  }

  const [{ noteId }, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);

  const [notesRes, skillsRes, attemptsRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content_md, skill_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("skills")
      .select("id, name, slug, mastery_score, status")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase
      .from("quiz_attempts")
      .select(
        "id, skill_id, source_type, score, total_questions, correct_answers, attempted_at",
      )
      .eq("user_id", user.id)
      .order("attempted_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <ClozeQuizRunner
      notes={notesRes.data ?? []}
      skills={skillsRes.data ?? []}
      recentAttempts={attemptsRes.data ?? []}
      initialNoteId={noteId ?? null}
    />
  );
}

export default function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ noteId?: string }>;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cloze Quiz"
        description="Uji active recall dari catatan Markdown Anda dan perbarui Mastery Score skill terkait."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat soal kuis...
          </div>
        }
      >
        <QuizContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
