import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { MarkdownEditor } from "@/components/notes/MarkdownEditor";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

async function NoteEditorLoader({
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
  const [noteRes, skillsRes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content_md, skill_id, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("skills")
      .select("id, name, slug")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  if (!noteRes.data) {
    notFound();
  }

  return <MarkdownEditor note={noteRes.data} skills={skillsRes.data ?? []} />;
}

export default function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor Catatan"
        description="Gunakan toolbar Cloze untuk menandai poin active recall tanpa merusak blok kode."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat editor catatan...
          </div>
        }
      >
        <NoteEditorLoader params={params} />
      </Suspense>
    </div>
  );
}
