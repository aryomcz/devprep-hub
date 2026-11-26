import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { ModuleTabs } from "@/components/tracks/ModuleTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import type { CachedCuratedResource } from "@/services/external/hybrid-sourcing";
import {
  conceptBriefSchema,
  handsOnTicketSchema,
  warmupDrillsSchema,
} from "@/types/schemas";

async function ModuleWorkspaceLoader({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(moduleId).success) {
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
  const [trackRes, moduleRes] = await Promise.all([
    supabase
      .from("learning_tracks")
      .select("id, capstone_title, primary_stack")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("track_modules")
      .select(
        "id, track_id, skill_id, order_index, module_type, target_language, objective, status, content_status, concept_brief, warmup_drills, hands_on_ticket",
      )
      .eq("id", moduleId)
      .eq("track_id", id)
      .maybeSingle(),
  ]);

  const track = trackRes.data;
  const mod = moduleRes.data;
  if (!track || !mod) {
    notFound();
  }

  const [skillRes, resourcesRes] = await Promise.all([
    supabase
      .from("skills")
      .select("id, name, slug, category")
      .eq("id", mod.skill_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("curated_resources")
      .select("id, skill_id, source, title, url, summary, fetched_at")
      .eq("skill_id", mod.skill_id)
      .order("fetched_at", { ascending: false }),
  ]);

  const skill = skillRes.data;
  if (!skill) {
    notFound();
  }

  const parsedBrief = conceptBriefSchema.safeParse(mod.concept_brief);
  const parsedDrills = warmupDrillsSchema.safeParse(mod.warmup_drills);
  const parsedTicket = handsOnTicketSchema.safeParse(mod.hands_on_ticket);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/tracks/${track.id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            <span>Kembali ke Peta Track</span>
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Modul #{mod.order_index}</Badge>
          <Badge variant="secondary">{skill.name}</Badge>
          <Badge variant="outline">{mod.target_language}</Badge>
        </div>
      </div>

      <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Objektif Modul:</span>{" "}
        {mod.objective}
      </p>

      <ModuleTabs
        track={track}
        moduleData={{
          id: mod.id,
          order_index: mod.order_index,
          module_type: mod.module_type,
          target_language: mod.target_language,
          objective: mod.objective,
          status: mod.status,
          content_status: mod.content_status,
          concept_brief: parsedBrief.success ? parsedBrief.data : null,
          warmup_drills: parsedDrills.success ? parsedDrills.data : null,
          hands_on_ticket: parsedTicket.success ? parsedTicket.data : null,
        }}
        skill={skill}
        initialResources={
          (resourcesRes.data ?? []) as CachedCuratedResource[]
        }
      />
    </div>
  );
}

export default function TrackModulePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Modul Praktikum"
        description="Pelajari konsep inti, referensi terkurasi, drill sintaks, dan tugas implementasi Capstone."
      />

      <Suspense
        fallback={
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Memuat workspace modul...
          </div>
        }
      >
        <ModuleWorkspaceLoader params={params} />
      </Suspense>
    </div>
  );
}
