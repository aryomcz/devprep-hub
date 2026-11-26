"use client";

import {
  AlertTriangle,
  BookmarkPlus,
  BookOpen,
  Check,
  Code2,
  ExternalLink,
  Lightbulb,
  Loader2,
  RefreshCw,
  Terminal,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { saveToNoteAction } from "@/actions/notes";
import { InlineBlankDrillRunner } from "@/components/tracks/InlineBlankDrillRunner";
import { ProgressiveHints } from "@/components/tracks/ProgressiveHints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CachedCuratedResource } from "@/services/external/hybrid-sourcing";
import type {
  ModuleContentStatus,
  ModuleStatus,
  ModuleType,
  SkillCategory,
} from "@/types/database";
import type {
  ConceptBrief,
  HandsOnTicket,
  WarmupDrill,
} from "@/types/schemas";

type ModuleWorkspaceProps = {
  track: {
    id: string;
    capstone_title: string;
    primary_stack: string;
  };
  moduleData: {
    id: string;
    order_index: number;
    module_type: ModuleType;
    target_language: string;
    objective: string;
    status: ModuleStatus;
    content_status: ModuleContentStatus;
    concept_brief: ConceptBrief | null;
    warmup_drills: WarmupDrill[] | null;
    hands_on_ticket: HandsOnTicket | null;
  };
  skill: {
    id: string;
    name: string;
    slug: string;
    category: SkillCategory;
  };
  initialResources: CachedCuratedResource[];
};

export function ModuleTabs({
  track,
  moduleData,
  skill,
  initialResources,
}: ModuleWorkspaceProps) {
  const router = useRouter();
  const autoTriggeredRef = useRef(false);

  const [contentStatus, setContentStatus] = useState<ModuleContentStatus>(
    moduleData.content_status,
  );
  const [conceptBrief, setConceptBrief] = useState<ConceptBrief | null>(
    moduleData.concept_brief,
  );
  const [warmupDrills, setWarmupDrills] = useState<WarmupDrill[] | null>(
    moduleData.warmup_drills,
  );
  const [handsOnTicket, setHandsOnTicket] = useState<HandsOnTicket | null>(
    moduleData.hands_on_ticket,
  );
  const [resources, setResources] =
    useState<CachedCuratedResource[]>(initialResources);

  const [generating, setGenerating] = useState(
    moduleData.content_status === "pending",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [saveNoteError, setSaveNoteError] = useState<string | null>(null);
  const [isSavingNote, startSaveNoteTransition] = useTransition();

  const triggerGenerate = useCallback(async () => {
    setGenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/tracks/${track.id}/modules/${moduleData.id}/generate`,
        { method: "POST" },
      );

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        content_status?: ModuleContentStatus;
        concept_brief?: ConceptBrief;
        warmup_drills?: WarmupDrill[];
        hands_on_ticket?: HandsOnTicket;
        curated_resources?: CachedCuratedResource[];
        error?: string;
      };

      if (!response.ok || data.content_status !== "ready") {
        setContentStatus("failed");
        setErrorMessage(
          data.error ??
            "Gagal menghasilkan materi modul. Anda bisa mencoba ulang tanpa kehilangan blueprint track.",
        );
        return;
      }

      setContentStatus("ready");
      setConceptBrief(data.concept_brief ?? null);
      setWarmupDrills(data.warmup_drills ?? null);
      setHandsOnTicket(data.hands_on_ticket ?? null);
      setResources(data.curated_resources ?? []);
      router.refresh();
    } catch {
      setContentStatus("failed");
      setErrorMessage("Gagal terhubung ke server generator modul.");
    } finally {
      setGenerating(false);
    }
  }, [moduleData.id, router, track.id]);

  useEffect(() => {
    if (moduleData.content_status === "pending" && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      void triggerGenerate();
    }
  }, [moduleData.content_status, triggerGenerate]);

  function handleSaveToNote() {
    if (!conceptBrief) return;
    setSaveNoteError(null);

    const definition = [
      conceptBrief.summary,
      "",
      `**Analogi:** ${conceptBrief.analogy}`,
      "",
      "**Poin Kunci:**",
      ...conceptBrief.key_points.map((point) => `- ${point}`),
    ].join("\n");

    startSaveNoteTransition(async () => {
      const result = await saveToNoteAction({
        title: `Modul #${moduleData.order_index}: ${skill.name} (${track.capstone_title})`,
        term: skill.name,
        definition,
        sourceLabel: `Capstone Track: ${track.capstone_title}`,
        skillId: skill.id,
      });

      if (!result.ok) {
        setSaveNoteError(result.error);
        return;
      }

      setSavedNoteId(result.data.noteId);
    });
  }

  if (generating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="size-4 animate-spin" />
            <span>Menyiapkan Modul #{moduleData.order_index} (On-Demand)</span>
          </CardTitle>
          <CardDescription>
            Mengambil referensi resmi (Hybrid Sourcing) dan menyusun Concept
            Brief, Warm-up Drill, serta Hands-On Ticket untuk {skill.name}...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (contentStatus === "failed" || !conceptBrief) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-4" />
            <span>Materi Modul Belum Siap (Failed)</span>
          </CardTitle>
          <CardDescription>
            {errorMessage ??
              "Generasi modul sebelumnya terhenti atau terkena rate limit Gemini API."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            onClick={() => void triggerGenerate()}
            className="gap-1.5"
          >
            <RefreshCw className="size-4" />
            <span>Coba Generate Ulang</span>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="concept" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
        <TabsTrigger value="concept" className="gap-1.5">
          <BookOpen className="size-3.5" />
          <span>1. Concept Brief</span>
        </TabsTrigger>
        <TabsTrigger value="drill" className="gap-1.5">
          <Code2 className="size-3.5" />
          <span>2. Warm-up Drill</span>
        </TabsTrigger>
        <TabsTrigger value="ticket" className="gap-1.5">
          <Wrench className="size-3.5" />
          <span>3. Hands-On Ticket</span>
        </TabsTrigger>
        <TabsTrigger value="review" className="gap-1.5">
          <Terminal className="size-3.5" />
          <span>4. Code Review</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="concept" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">
                Ringkasan Konsep: {skill.name}
              </CardTitle>
              <CardDescription>
                Terintegrasi pada {track.capstone_title} (
                {moduleData.target_language})
              </CardDescription>
            </div>

            {savedNoteId ? (
              <Link href={`/notes/${savedNoteId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Check className="size-4 text-emerald-600" />
                  <span>Tersimpan • Buka Catatan</span>
                </Button>
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingNote}
                onClick={handleSaveToNote}
                className="gap-1.5"
              >
                <BookmarkPlus className="size-4" />
                <span>{isSavingNote ? "Menyimpan..." : "Save to Note"}</span>
              </Button>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {saveNoteError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {saveNoteError}
              </div>
            ) : null}

            <p className="text-sm leading-relaxed">{conceptBrief.summary}</p>

            <div className="rounded-lg border bg-muted/40 p-3.5">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                <Lightbulb className="size-3.5 text-amber-500" />
                <span>Analogi Praktis</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {conceptBrief.analogy}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Poin Kunci
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {conceptBrief.key_points.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Referensi Terkurasi ({resources.length})
            </CardTitle>
            <CardDescription>
              Hasil Hybrid Sourcing dari sumber publik resmi (cache 7 hari di
              PostgreSQL).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada referensi eksternal ter-cache untuk skill ini.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {resources.map((res) => (
                  <div
                    key={res.url}
                    className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {res.source}
                        </Badge>
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                        >
                          <span className="truncate">{res.title}</span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      </div>
                      {res.summary ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {res.summary}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="drill">
        <InlineBlankDrillRunner
          drills={warmupDrills ?? []}
          skillId={skill.id}
          skillName={skill.name}
        />
      </TabsContent>

      <TabsContent value="ticket">
        {handsOnTicket ? (
          <ProgressiveHints
            ticket={handsOnTicket}
            capstoneTitle={track.capstone_title}
            targetLanguage={moduleData.target_language}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hands-On Ticket Belum Siap</CardTitle>
            </CardHeader>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="review">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Code Submission &amp; Review</CardTitle>
            <CardDescription>
              Panel kirim potongan kode / commit GitHub dan pembuatan otomatis 2
              InterviewCard baru akan disambungkan pada Step 4.4.
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
