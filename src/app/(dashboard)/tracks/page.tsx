import { ArrowRight, Layers, Rocket } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  TrackGeneratorDialog,
  TrackStatusBar,
} from "@/components/tracks/TrackBlueprintControls";
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
import { createClient } from "@/lib/supabase/server";

async function TracksContent({
  searchParams,
}: {
  searchParams: Promise<{ internshipId?: string }>;
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

  const [{ internshipId }, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);

  const [tracksRes, modulesRes, internshipsRes, skillsRes] = await Promise.all([
    supabase
      .from("learning_tracks")
      .select(
        "id, internship_id, capstone_title, capstone_description, primary_stack, status, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("track_modules").select("id, track_id, status"),
    supabase
      .from("target_internships")
      .select("id, title, company_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("skills")
      .select("id, name, category, status")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  const tracks = tracksRes.data ?? [];
  const modulesByTrack = new Map<string, Array<{ status: string }>>();

  for (const mod of modulesRes.data ?? []) {
    const list = modulesByTrack.get(mod.track_id) ?? [];
    list.push(mod);
    modulesByTrack.set(mod.track_id, list);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {tracks.length} Learning Track tersimpan
        </div>

        <TrackGeneratorDialog
          internships={internshipsRes.data ?? []}
          skills={skillsRes.data ?? []}
          initialInternshipId={internshipId ?? null}
        />
      </div>

      {tracks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="size-4" />
              <span>Belum Ada Learning Track</span>
            </CardTitle>
            <CardDescription>
              Klik <strong>Buat Capstone Track</strong> untuk merancang
              arsitektur One-App Capstone beserta kerangka modul bertahap.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tracks.map((track) => {
            const mods = modulesByTrack.get(track.id) ?? [];
            const completedCount = mods.filter(
              (m) => m.status === "completed",
            ).length;
            const progressPct =
              mods.length > 0
                ? Math.round((completedCount / mods.length) * 100)
                : 0;

            return (
              <Card key={track.id} className="flex flex-col justify-between">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={`/tracks/${track.id}`}
                        className="hover:underline"
                      >
                        <CardTitle className="truncate text-base">
                          {track.capstone_title}
                        </CardTitle>
                      </Link>
                      <CardDescription className="line-clamp-2 text-xs">
                        {track.capstone_description}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {track.primary_stack}
                    </Badge>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="size-3.5" />
                        <span>
                          {completedCount}/{mods.length} modul selesai
                        </span>
                      </span>
                      <span>{progressPct}%</span>
                    </div>
                    <Progress value={progressPct} className="w-full" />
                  </div>
                </CardHeader>

                <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <TrackStatusBar trackId={track.id} status={track.status} />

                  <Link href={`/tracks/${track.id}`}>
                    <Button variant="outline" size="xs" className="gap-1">
                      <span>Buka Peta Modul</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TracksPage({
  searchParams,
}: {
  searchParams: Promise<{ internshipId?: string }>;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Tracks & One-App Capstone"
        description="Cetak biru aplikasi utama dan urutan praktikum modul on-demand dari skill target Anda."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat Learning Tracks...
          </div>
        }
      >
        <TracksContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
