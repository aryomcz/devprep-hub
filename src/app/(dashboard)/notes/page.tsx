import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  NotesDirectory,
  type NoteSummary,
} from "@/components/notes/MarkdownEditor";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { parseClozeMarkdown } from "@/lib/cloze-parser";
import { createClient } from "@/lib/supabase/server";

async function NotesContent() {
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
  const [notesRes, skillsRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content_md, skill_id, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("skills")
      .select("id, name, slug")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  const summaries: NoteSummary[] = (notesRes.data ?? []).map((note) => ({
    ...note,
    clozeCount: parseClozeMarkdown(note.content_md).clozeCount,
  }));

  return <NotesDirectory notes={summaries} skills={skillsRes.data ?? []} />;
}

export default function NotesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Notes &amp; Cheat-Sheet"
        description="Catatan Markdown pribadi per skill dengan sintaks Cloze {{...}} dan {{cloze:...}} untuk kuis active recall serta cetak A4."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat catatan...
          </div>
        }
      >
        <NotesContent />
      </Suspense>
    </div>
  );
}
