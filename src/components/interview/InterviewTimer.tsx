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

export type InterviewSkillItem = {
  id: string;
  name: string;
  status: SkillStatus;
  mastery_score: number;
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

const SOURCE_LABELS: Record<InterviewCardSource, string> = {
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
              <Badge variant="outline">{SOURCE_LABELS[card.source]}</Badge>
              <span className="text-xs text-muted-foreground">
                Direview {card.review_count}x
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm font-semibold ${
                  remainingSeconds === 0
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-muted/50"
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
            <div className="space-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  <span>Sesi wawancara tersimpan</span>
                </span>
                <Badge variant="default">
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
              <span className="text-muted-foreground">
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

          <div className="space-y-2 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground">
              Penilaian Mandiri &amp; Jadwal Pengulangan Berkala:
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleEvaluate("confused")}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Confused (+2 Hari)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleEvaluate("partial")}
                className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
              >
                Partial (+5 Hari)
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => handleEvaluate("ready")}
              >
                Ready (+14 Hari)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Riwayat Sesi Interview ({cardAttempts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cardAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada riwayat sesi latihan untuk kartu ini.
            </p>
          ) : (
            <div className="space-y-2.5">
              {cardAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="space-y-1 rounded-lg border p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {CONFIDENCE_LABELS[attempt.confidence_level]}
                      </Badge>
                      <span className="text-muted-foreground">
                        Durasi: {attempt.duration_seconds} detik
                      </span>
                    </div>
                    <span className="text-muted-foreground">
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
