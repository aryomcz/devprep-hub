import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { A4PrintView } from "@/components/notes/A4PrintView";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

async function NotePrintLoader({
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
  const { data: note } = await supabase
    .from("notes")
    .select("id, title, content_md, skill_id, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!note) {
    notFound();
  }

  let skillName: string | null = null;
  if (note.skill_id) {
    const { data: skill } = await supabase
      .from("skills")
      .select("name")
      .eq("id", note.skill_id)
      .eq("user_id", user.id)
      .maybeSingle();
    skillName = skill?.name ?? null;
  }

  return <A4PrintView note={note} skillName={skillName} />;
}

export default function NotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Menyiapkan tampilan cetak A4...
        </div>
      }
    >
      <NotePrintLoader params={params} />
    </Suspense>
  );
}
