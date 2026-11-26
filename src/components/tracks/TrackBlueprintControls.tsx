"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import {
  deleteTrackAction,
  unlockNextModuleAction,
  updateTrackStatusAction,
} from "@/actions/tracks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LanguageSkillMode } from "@/services/ai/track-generator";
import type { SkillCategory, SkillStatus, TrackStatus } from "@/types/database";

export type InternshipOption = {
  id: string;
  title: string;
  company_name: string;
};

export type TrackSkillOption = {
  id: string;
  name: string;
  category: SkillCategory;
  status: SkillStatus;
};

const TRACK_STATUS_LABELS: Record<TrackStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const TRACK_STATUS_OPTIONS: TrackStatus[] = [
  "active",
  "completed",
  "archived",
];

export function TrackGeneratorDialog({
  internships,
  skills,
  initialInternshipId,
}: {
  internships: InternshipOption[];
  skills: TrackSkillOption[];
  initialInternshipId?: string | null;
}) {
  const router = useRouter();
  const hasValidInitialInternship = Boolean(
    initialInternshipId &&
      internships.some((item) => item.id === initialInternshipId),
  );

  const [open, setOpen] = useState(hasValidInitialInternship);
  const [sourceMode, setSourceMode] = useState<"internship" | "skills">(
    hasValidInitialInternship || internships.length > 0
      ? "internship"
      : "skills",
  );
  const [selectedInternshipId, setSelectedInternshipId] = useState<string>(
    hasValidInitialInternship
      ? (initialInternshipId ?? "")
      : (internships[0]?.id ?? ""),
  );
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(() =>
    skills
      .filter((s) => s.status !== "mastered")
      .slice(0, 5)
      .map((s) => s.id),
  );
  const [languageMode, setLanguageMode] =
    useState<LanguageSkillMode>("microservice");
  const [submitting, setSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const internshipMap = useMemo(
    () => new Map(internships.map((item) => [item.id, item])),
    [internships],
  );

  function toggleSkill(skillId: string) {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : prev.length < 10
          ? [...prev, skillId]
          : prev,
    );
  }

  async function runGenerate() {
    if (sourceMode === "internship" && !selectedInternshipId) {
      setErrorMessage("Pilih Target Internship terlebih dahulu.");
      return;
    }
    if (sourceMode === "skills" && selectedSkillIds.length === 0) {
      setErrorMessage("Pilih minimal 1 Skill target.");
      return;
    }

    setSubmitting(true);
    setRateLimited(false);
    setErrorMessage(null);

    try {
      const payload =
        sourceMode === "internship"
          ? { internshipId: selectedInternshipId, languageMode }
          : { skillIds: selectedSkillIds, languageMode };

      const response = await fetch("/api/tracks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        trackId?: string;
        error?: string;
        code?: string;
      };

      if (!response.ok || !data.trackId) {
        setRateLimited(response.status === 429 || data.code === "RATE_LIMIT");
        setErrorMessage(data.error ?? "Gagal membuat blueprint Learning Track.");
        return;
      }

      setOpen(false);
      router.push(`/tracks/${data.trackId}`);
      router.refresh();
    } catch {
      setErrorMessage("Gagal terhubung ke server generator.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runGenerate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setErrorMessage(null);
          setRateLimited(false);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="size-4" />
        <span>Buat Capstone Track</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Buat Blueprint One-App Capstone</DialogTitle>
          <DialogDescription>
            Tahap 1 hanya menyusun arsitektur &amp; kerangka modul (pending).
            Materi &amp; soal tiap modul akan di-generate on-demand saat dibuka.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {rateLimited ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => void runGenerate()}
                  className="gap-1 bg-background text-foreground"
                >
                  <RefreshCw className="size-3" />
                  <span>Coba Generate Ulang</span>
                </Button>
              ) : null}
            </div>
          ) : null}

          <Tabs
            value={sourceMode}
            onValueChange={(value) => {
              if (value === "internship" || value === "skills") {
                setSourceMode(value);
                setErrorMessage(null);
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="internship">Dari Target Magang</TabsTrigger>
              <TabsTrigger value="skills">Pilih Skill Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="internship" className="mt-3 space-y-2">
              <label className="text-xs font-medium">Target Internship</label>
              {internships.length === 0 ? (
                <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Belum ada Target Internship. Gunakan tab Pilih Skill Manual
                  atau analisis lowongan di /internships.
                </p>
              ) : (
                <Select
                  value={selectedInternshipId}
                  onValueChange={(val) => setSelectedInternshipId(val ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {internshipMap.get(selectedInternshipId)
                        ? `${internshipMap.get(selectedInternshipId)?.title} (${internshipMap.get(selectedInternshipId)?.company_name || "Umum"})`
                        : "Pilih target lowongan"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {internships.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title} ({item.company_name || "Umum"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </TabsContent>

            <TabsContent value="skills" className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  Pilih Skill Prioritas (maks. 10)
                </span>
                <span className="text-muted-foreground">
                  {selectedSkillIds.length} / 10 dipilih
                </span>
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border p-2.5">
                {skills.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada Skill di Master Skills.
                  </p>
                ) : (
                  skills.map((skill) => {
                    const checked = selectedSkillIds.includes(skill.id);
                    return (
                      <label
                        key={skill.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted/60"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSkill(skill.id)}
                          />
                          <span className="font-medium">{skill.name}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {skill.category} • {skill.status}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Mode untuk Bahasa Pemrograman Baru (di luar primary stack)
            </label>
            <Select
              value={languageMode}
              onValueChange={(val) => {
                if (val === "microservice" || val === "language_native") {
                  setLanguageMode(val);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {languageMode === "microservice"
                    ? "Microservice (terhubung ke One-App Capstone)"
                    : "Language Native (mini-app sesuai idiom bahasa)"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="microservice">
                  Microservice (terhubung ke One-App Capstone)
                </SelectItem>
                <SelectItem value="language_native">
                  Language Native (mini-app sesuai idiom bahasa)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              <Rocket className="size-4" />
              <span>
                {submitting
                  ? "Menyusun Blueprint..."
                  : "Generate Blueprint Track"}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TrackStatusBar({
  trackId,
  status,
  redirectAfterDelete = false,
}: {
  trackId: string;
  status: TrackStatus;
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<TrackStatus>(status);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(nextVal: string | null) {
    if (!nextVal || !TRACK_STATUS_OPTIONS.includes(nextVal as TrackStatus)) {
      return;
    }
    const nextStatus = nextVal as TrackStatus;
    const prev = currentStatus;
    setCurrentStatus(nextStatus);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await updateTrackStatusAction({
        trackId,
        status: nextStatus,
      });
      if (!result.ok) {
        setCurrentStatus(prev);
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteTrackAction(trackId);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      if (redirectAfterDelete) {
        router.push("/tracks");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Select
          value={currentStatus}
          onValueChange={handleStatusChange}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue>{TRACK_STATUS_LABELS[currentStatus]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TRACK_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {TRACK_STATUS_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isPending}
          aria-label="Hapus Learning Track"
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {errorMessage ? (
        <p className="text-[11px] text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

export function UnlockModuleButton({
  trackId,
  moduleId,
}: {
  trackId: string;
  moduleId: string;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleComplete() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await unlockNextModuleAction({ trackId, moduleId });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={isPending}
        onClick={handleComplete}
        className="gap-1.5"
      >
        <CheckCircle2 className="size-3.5" />
        <span>{isPending ? "Memproses..." : "Tandai Selesai & Buka Lanjut"}</span>
      </Button>
      {errorMessage ? (
        <p className="text-[11px] text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
