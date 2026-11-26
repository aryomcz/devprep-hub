"use client";

import { CalendarClock, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { createInterviewCardAction } from "@/actions/interview";
import {
  INTERVIEW_CARD_SOURCE_LABELS,
  InterviewTimer,
  type InterviewAttemptItem,
  type InterviewCardItem,
} from "@/components/interview/InterviewTimer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { isCardDue, sortDueInterviewCards } from "@/lib/spaced-repetition";
import type { InterviewCardSource, SkillStatus } from "@/types/database";

export type InterviewSkillItem = {
  id: string;
  name: string;
  status: SkillStatus;
};

const SOURCE_FILTER_LABELS: Record<"all" | InterviewCardSource, string> = {
  all: "Semua Sumber",
  ...INTERVIEW_CARD_SOURCE_LABELS,
};

export function SpacedRepetitionQueue({
  cards,
  skills,
  attempts,
  serverNowIso,
}: {
  cards: InterviewCardItem[];
  skills: InterviewSkillItem[];
  attempts: InterviewAttemptItem[];
  serverNowIso: string;
}) {
  const router = useRouter();
  const [skillFilter, setSkillFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<
    "all" | InterviewCardSource
  >("all");
  const [selectedCardId, setSelectedCardId] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newSkillId, setNewSkillId] = useState(skills[0]?.id ?? "");
  const [newSource, setNewSource] = useState<"manual" | "skill_gap">("manual");
  const [newPrompt, setNewPrompt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const skillMap = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill])),
    [skills],
  );

  const selectableSkills = useMemo(
    () =>
      newSource === "skill_gap"
        ? skills.filter((skill) => skill.status === "gap")
        : skills,
    [newSource, skills],
  );

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (skillFilter !== "all" && card.skill_id !== skillFilter) return false;
      if (sourceFilter !== "all" && card.source !== sourceFilter) return false;
      return true;
    });
  }, [cards, skillFilter, sourceFilter]);

  const { dueCards, upcomingCards } = useMemo(() => {
    const now = new Date(serverNowIso);
    const due = sortDueInterviewCards(filteredCards, now);
    const upcoming = filteredCards
      .filter((card) => !isCardDue(card, now))
      .sort(
        (a, b) =>
          Date.parse(a.next_review_at) - Date.parse(b.next_review_at),
      );
    return { dueCards: due, upcomingCards: upcoming };
  }, [filteredCards, serverNowIso]);

  const activeCard = useMemo(() => {
    if (selectedCardId) {
      const explicit = filteredCards.find((c) => c.id === selectedCardId);
      if (explicit) return explicit;
    }
    return dueCards[0] ?? upcomingCards[0] ?? null;
  }, [dueCards, filteredCards, selectedCardId, upcomingCards]);

  const activeCardAttempts = useMemo(() => {
    if (!activeCard) return [];
    return attempts.filter((a) => a.card_id === activeCard.id);
  }, [activeCard, attempts]);

  function handleCreateCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    startTransition(async () => {
      const result = await createInterviewCardAction({
        skillId: newSkillId,
        source: newSource,
        questionPrompt: newPrompt,
      });

      if (!result.ok) {
        setCreateError(result.error);
        return;
      }

      setCreateOpen(false);
      setNewPrompt("");
      setSelectedCardId(result.data.cardId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={skillFilter}
            onValueChange={(value) => setSkillFilter(value ?? "all")}
          >
            <SelectTrigger className="w-48">
              <SelectValue>
                {skillFilter === "all"
                  ? "Semua Skill"
                  : (skillMap.get(skillFilter)?.name ?? "Skill")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Skill</SelectItem>
              {skills.map((skill) => (
                <SelectItem key={skill.id} value={skill.id}>
                  {skill.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sourceFilter}
            onValueChange={(value) => {
              if (
                value === "all" ||
                value === "lab_review" ||
                value === "skill_gap" ||
                value === "manual"
              ) {
                setSourceFilter(value);
              }
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue>{SOURCE_FILTER_LABELS[sourceFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sumber</SelectItem>
              <SelectItem value="lab_review">Hasil Lab Review</SelectItem>
              <SelectItem value="skill_gap">Skill Gap</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreateError(null);
          }}
        >
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" />
            <span>Kartu Interview Baru</span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Kartu Interview</DialogTitle>
              <DialogDescription>
                Buat pertanyaan wawancara manual atau seed pertanyaan standar
                dari topik Skill Gap.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCard} className="space-y-4">
              {createError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {createError}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Skill Terkait</label>
                <Select
                  value={newSkillId}
                  onValueChange={(val) => setNewSkillId(val ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {skillMap.get(newSkillId)?.name ?? "Pilih Skill"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {selectableSkills.map((skill) => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name} ({skill.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Sumber Kartu</label>
                <Select
                  value={newSource}
                  onValueChange={(val) => {
                    if (val === "manual" || val === "skill_gap") {
                      setNewSource(val);
                      if (
                        val === "skill_gap" &&
                        skillMap.get(newSkillId)?.status !== "gap"
                      ) {
                        const firstGap = skills.find((s) => s.status === "gap");
                        setNewSkillId(firstGap?.id ?? "");
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {newSource === "manual" ? "Manual" : "Seed Skill Gap"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="skill_gap">Seed Skill Gap</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="card-prompt" className="text-xs font-medium">
                  Pertanyaan{" "}
                  {newSource === "skill_gap" ? "(opsional)" : "(wajib)"}
                </label>
                <Textarea
                  id="card-prompt"
                  rows={3}
                  value={newPrompt}
                  onChange={(event) => setNewPrompt(event.target.value)}
                  placeholder={
                    newSource === "skill_gap"
                      ? "Kosongkan untuk membuat pertanyaan standar dari nama Skill..."
                      : "Contoh: Apa trade-off indexing B-Tree vs GIN di PostgreSQL?"
                  }
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isPending || !newSkillId}>
                  {isPending ? "Menyimpan..." : "Simpan Kartu"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Jatuh Tempo Hari Ini</span>
                <Badge variant={dueCards.length > 0 ? "default" : "secondary"}>
                  {dueCards.length} Kartu
                </Badge>
              </CardTitle>
              <CardDescription>
                Diurutkan dari kartu yang paling lama tertunda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dueCards.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Tidak ada Kartu Interview yang jatuh tempo sekarang.
                </p>
              ) : (
                <div className="space-y-2">
                  {dueCards.map((card) => {
                    const isSelected = activeCard?.id === card.id;
                    const skillName =
                      skillMap.get(card.skill_id)?.name ?? "Skill";

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelectedCardId(card.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {skillName}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {INTERVIEW_CARD_SOURCE_LABELS[card.source]}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {card.review_count}x
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs font-medium">
                          {card.question_prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <span>Terjadwal Mendatang</span>
                </span>
                <Badge variant="outline">{upcomingCards.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingCards.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada kartu terjadwal di masa depan.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {upcomingCards.map((card) => {
                    const isSelected = activeCard?.id === card.id;
                    const skillName =
                      skillMap.get(card.skill_id)?.name ?? "Skill";

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setSelectedCardId(card.id)}
                        className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-medium">{skillName}</span>
                          <span className="text-muted-foreground">
                            {new Date(card.next_review_at).toLocaleDateString(
                              "id-ID",
                              { day: "2-digit", month: "short" },
                            )}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {card.question_prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <InterviewTimer
            key={activeCard?.id ?? "empty"}
            card={activeCard}
            skillName={
              activeCard
                ? (skillMap.get(activeCard.skill_id)?.name ?? "Skill")
                : ""
            }
            cardAttempts={activeCardAttempts}
            onSubmitted={(cardId) => setSelectedCardId(cardId)}
          />
        </div>
      </div>
    </div>
  );
}
