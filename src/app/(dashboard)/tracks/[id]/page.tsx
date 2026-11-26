import { ArrowLeft, ArrowRight, Lock, Layers } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  TrackStatusBar,
  UnlockModuleButton,
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
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import type {
  ModuleContentStatus,
  ModuleStatus,
  ModuleType,
} from "@/types/database";

const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  locked: "Locked",
  in_progress: "In Progress",
  completed: "Completed",
};

const CONTENT_STATUS_LABELS: Record<ModuleContentStatus, string> = {
  pending: "Belum Di-generate",
  ready: "Materi Siap",
  failed: "Gagal Generate",
};

const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  capstone_feature: "Capstone Feature",
  microservice: "Microservice",
  language_native: "Language Native",
};

async function TrackDetailLoader({
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
  const [trackRes, modulesRes, skillsRes] = await Promise.all([
    supabase
      .from("learning_tracks")
      .select(
        "id, internship_id, capstone_title, capstone_description, primary_stack, architecture_overview, status, created_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("track_modules")
      .select(
        "id, skill_id, order_index, module_type, target_language, objective, content_status, status",
      )
      .eq("track_id", id)
      .order("order_index", { ascending: true }),
    supabase.from("skills").select("id, name, slug").eq("user_id", user.id),
  ]);

  const track = trackRes.data;
  if (!track) {
    notFound();
  }

  const skillById = new Map((skillsRes.data ?? []).map((s) => [s.id, s]));
  const modules = modulesRes.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/tracks">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            <span>Kembali ke Learning Tracks</span>
          </Button>
        </Link>

        <TrackStatusBar
          trackId={track.id}
          status={track.status}
          redirectAfterDelete
        />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{track.capstone_title}</CardTitle>
              <CardDescription className="mt-1">
                {track.capstone_description}
              </CardDescription>
            </div>
            <Badge variant="secondary">{track.primary_stack}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 border-t pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Arsitektur One-App Capstone
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {track.architecture_overview}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Layers className="size-4" />
          <span>Peta Urutan Modul ({modules.length})</span>
        </h2>

        {modules.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Belum ada modul pada track ini.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {modules.map((mod) => {
              const skill = skillById.get(mod.skill_id);
              const isLocked = mod.status === "locked";

              return (
                <Card key={mod.id} className={isLocked ? "opacity-75" : ""}>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          Modul #{mod.order_index}
                        </span>
                        <span className="font-semibold text-sm">
                          {skill?.name ?? "Skill"}
                        </span>
                        <Badge variant="outline" className="text-[11px]">
                          {MODULE_TYPE_LABELS[mod.module_type]}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          {mod.target_language}
                        </Badge>
                        <Badge
                          variant={
                            mod.status === "completed"
                              ? "default"
                              : mod.status === "in_progress"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {MODULE_STATUS_LABELS[mod.status]}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          {CONTENT_STATUS_LABELS[mod.content_status]}
                        </Badge>
                      </div>

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {mod.objective}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {mod.status === "in_progress" ? (
                        <UnlockModuleButton
                          trackId={track.id}
                          moduleId={mod.id}
                        />
                      ) : null}

                      {isLocked ? (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled
                          className="gap-1"
                        >
                          <Lock className="size-3" />
                          <span>Terkunci</span>
                        </Button>
                      ) : (
                        <Link href={`/tracks/${track.id}/modules/${mod.id}`}>
                          <Button size="xs" className="gap-1">
                            <span>Buka Modul</span>
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Blueprint Capstone Track"
        description="Peta urutan modul praktikum dan arsitektur aplikasi utama."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat blueprint track...
          </div>
        }
      >
        <TrackDetailLoader params={params} />
      </Suspense>
    </div>
  );
}
