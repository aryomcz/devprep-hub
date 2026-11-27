"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { submitInterviewAttemptAction } from "@/actions/interview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  ConfidenceLevel,
  InterviewCardSource,
  SkillStatus,
} from "@/types/database";

export type InterviewCardItem = {
  id: string;
  skill_id: string;
  question_prompt: string;
  source: InterviewCardSource;
  confidence_level: ConfidenceLevel | null;
  review_count: number;
  next_review_at: string;
};

export type InterviewAttemptItem = {
  id: string;
  card_id: string;
  skill_id: string;
  user_notes: string;
  duration_seconds: number;
  confidence_level: ConfidenceLevel;
  attempted_at: string;
};

const DEFAULT_DURATION_SECONDS = 120;

const THREE_POINT_TEMPLATE = [
  "1. Definisi: ",
  "2. Masalah yang Diselesaikan: ",
  "3. Trade-off & Batasan: ",
].join("\n\n");

export const INTERVIEW_CARD_SOURCE_LABELS: Record<InterviewCardSource, string> =
  {
    lab_review: "Hasil Lab Review",
    skill_gap: "Skill Gap",
    manual: "Manual",
  };

const STATUS_LABELS: Record<SkillStatus, string> = {
  gap: "Gap",
  learning: "Learning",
  mastered: "Mastered",
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  confused: "Confused",
  partial: "Partial",
  ready: "Ready",
};

const CONFIDENCE_VARIANTS: Record<
  ConfidenceLevel,
  "gap" | "learning" | "mastered"
> = {
  confused: "gap",
  partial: "learning",
  ready: "mastered",
};

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function InterviewTimer({
  card,
  skillName,
  cardAttempts,
  onSubmitted,
}: {
  card: InterviewCardItem | null;
  skillName: string;
  cardAttempts: InterviewAttemptItem[];
  onSubmitted?: (cardId: string) => void;
}) {
  const router = useRouter();
  const [remainingSeconds, setRemainingSeconds] = useState(
    DEFAULT_DURATION_SECONDS,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [userNotes, setUserNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedInfo, setSubmittedInfo] = useState<{
    nextReviewAt: string;
    masteryScore: number;
    skillStatus: SkillStatus;
    capped: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function handleResetTimer() {
    setRunning(false);
    setRemainingSeconds(DEFAULT_DURATION_SECONDS);
    setElapsedSeconds(0);
  }

  function handleFillTemplate() {
    setUserNotes((prev) =>
      prev.trim()
        ? `${prev.trimEnd()}\n\n${THREE_POINT_TEMPLATE}`
        : THREE_POINT_TEMPLATE,
    );
  }

  function handleEvaluate(confidenceLevel: ConfidenceLevel) {
    if (!card) return;
    setRunning(false);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await submitInterviewAttemptAction({
        cardId: card.id,
        durationSeconds: elapsedSeconds,
        userNotes,
        confidenceLevel,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setSubmittedInfo(result.data);
      onSubmitted?.(card.id);
      router.refresh();
    });
  }

  if (!card) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pilih Kartu Interview dari Antrean
          </CardTitle>
          <CardDescription>
            Pilih salah satu kartu jatuh tempo atau buat kartu baru untuk mulai
            berlatih simulasi wawancara 2 menit.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{skillName}</Badge>
              <Badge variant="mono">
                {INTERVIEW_CARD_SOURCE_LABELS[card.source]}
              </Badge>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                Direview {card.review_count}x
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ${
                  remainingSeconds === 0
                    ? "border-[color-mix(in_oklab,var(--status-learning)_45%,transparent)] bg-[color-mix(in_oklab,var(--status-learning)_12%,transparent)] text-[var(--status-learning)]"
                    : "border-border bg-muted/50 text-foreground"
                }`}
              >
                <Clock className="size-3.5" />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>

              {running ? (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setRunning(false)}
                  className="gap-1"
                >
                  <Pause className="size-3.5" />
                  <span>Jeda</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  onClick={() => setRunning(true)}
                  className="gap-1"
                >
                  <Play className="size-3.5" />
                  <span>Mulai</span>
                </Button>
              )}

              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={handleResetTimer}
                aria-label="Reset timer"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          </div>

          <CardTitle className="pt-2 text-base leading-snug">
            {card.question_prompt}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}

          {submittedInfo ? (
            <div className="space-y-1.5 rounded-lg border border-[color-mix(in_oklab,var(--status-mastered)_40%,transparent)] bg-[color-mix(in_oklab,var(--status-mastered)_10%,transparent)] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-[var(--status-mastered)]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  <span>Sesi wawancara tersimpan</span>
                </span>
                <Badge
                  variant={submittedInfo.skillStatus}
                  className="font-mono tabular-nums"
                >
                  Mastery {skillName}: {submittedInfo.masteryScore}% (
                  {STATUS_LABELS[submittedInfo.skillStatus]})
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Review berikutnya dijadwalkan pada{" "}
                {new Date(submittedInfo.nextReviewAt).toLocaleDateString(
                  "id-ID",
                  { day: "2-digit", month: "short", year: "numeric" },
                )}
                .
                {submittedInfo.capped
                  ? " Skor masih dibatasi maks. 65% sampai ada sinyal Quiz/Lab tambahan."
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-semibold">Panduan Kerangka 3 Poin</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleFillTemplate}
                className="gap-1 text-xs"
              >
                <FileText className="size-3" />
                <span>Isi Kerangka</span>
              </Button>
            </div>
            <ol className="list-decimal space-y-0.5 pl-4 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Definisi</span> —
                jelaskan konsep atau mekanismenya secara ringkas.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Masalah yang Diselesaikan
                </span>{" "}
                — mengapa pola/tool ini dipakai di produksi.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Trade-off &amp; Batasan
                </span>{" "}
                — biaya performa, kompleksitas, atau kasus kegagalan.
              </li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="interview-notes" className="font-medium">
                Catatan Kerangka Jawaban
              </label>
              <span className="font-mono tabular-nums text-muted-foreground">
                Durasi tercatat: {elapsedSeconds} detik
              </span>
            </div>
            <Textarea
              id="interview-notes"
              rows={6}
              disabled={isPending}
              value={userNotes}
              onChange={(event) => setUserNotes(event.target.value)}
              placeholder="Tulis poin jawaban Anda atau latih secara lisan sebelum menilai kesiapan..."
              className="text-sm leading-relaxed"
            />
          </div>

          <div className="space-y-2 border-t border-border/80 pt-3">
            <div className="text-xs font-medium text-muted-foreground">
              Penilaian Mandiri &amp; Jadwal Pengulangan Berkala:
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleEvaluate("confused")}
                className="border-[color-mix(in_oklab,var(--status-gap)_40%,transparent)] text-[var(--status-gap)] hover:bg-[color-mix(in_oklab,var(--status-gap)_10%,transparent)]"
              >
                Confused (+2 Hari)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleEvaluate("partial")}
                className="border-[color-mix(in_oklab,var(--status-learning)_40%,transparent)] text-[var(--status-learning)] hover:bg-[color-mix(in_oklab,var(--status-learning)_10%,transparent)]"
              >
                Partial (+5 Hari)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleEvaluate("ready")}
                className="border-[color-mix(in_oklab,var(--status-mastered)_40%,transparent)] bg-[color-mix(in_oklab,var(--status-mastered)_10%,transparent)] text-[var(--status-mastered)] hover:bg-[color-mix(in_oklab,var(--status-mastered)_18%,transparent)]"
              >
                Ready (+14 Hari)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span>Riwayat Sesi Interview</span>
            <Badge variant="mono" className="tabular-nums">
              {cardAttempts.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cardAttempts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-5 text-center text-sm text-muted-foreground">
              Belum ada riwayat sesi latihan untuk kartu ini.
            </div>
          ) : (
            <div className="space-y-2.5">
              {cardAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={CONFIDENCE_VARIANTS[attempt.confidence_level]}
                      >
                        {CONFIDENCE_LABELS[attempt.confidence_level]}
                      </Badge>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        Durasi: {attempt.duration_seconds} detik
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {new Date(attempt.attempted_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {attempt.user_notes ? (
                    <p className="whitespace-pre-line text-muted-foreground">
                      {attempt.user_notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
