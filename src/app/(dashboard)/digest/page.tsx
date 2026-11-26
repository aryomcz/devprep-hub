import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DigestArchive } from "@/components/digest/DigestArchive";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

async function DigestLoader() {
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
  const [digestsRes, skillsRes] = await Promise.all([
    supabase
      .from("daily_digests")
      .select("id, source, title, url, matched_skill_id, is_read, digest_date")
      .eq("user_id", user.id)
      .order("digest_date", { ascending: false })
      .limit(40),
    supabase
      .from("skills")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  return (
    <DigestArchive
      digests={digestsRes.data ?? []}
      skills={skillsRes.data ?? []}
    />
  );
}

export default function DigestPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Digest"
        description="Kurasi artikel teknis harian dari Dev.to & Hacker News untuk skill Gap dan Learning Anda."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat arsip Daily Digest...
          </div>
        }
      >
        <DigestLoader />
      </Suspense>
    </div>
  );
}
