"use client";

import {
  AlertTriangle,
  CheckCircle2,
  GitCommitHorizontal,
  MessageSquare,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toSafeExternalHref } from "@/lib/safe-url";
import type { SkillStatus } from "@/types/database";
import type { AiReviewFeedback } from "@/types/schemas";

const SKILL_STATUS_LABELS: Record<SkillStatus, string> = {
  gap: "Gap",
  learning: "Learning",
  mastered: "Mastered",
};

export type LabSubmissionHistoryItem = {
  id: string;
  repo_commit_url: string;
  passed: boolean;
  submitted_at: string;
  feedback: AiReviewFeedback | null;
  interview_questions: string[];
};

type ReviewSuccessState = {
  passed: boolean;
  feedback: AiReviewFeedback;
  interviewQuestions: string[];
  unlockedModuleId: string | null;
  masteryScore: number;
  skillStatus: SkillStatus;
  capped: boolean;
  truncated: boolean;
  skippedFiles: string[];
};

export function CodeReviewPanel({
  trackId,
  moduleId,
  skillName,
  initialSubmissions,
}: {
  trackId: string;
  moduleId: string;
  skillName: string;
  initialSubmissions: LabSubmissionHistoryItem[];
}) {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<"snippet" | "commit">("snippet");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [repoCommitUrl, setRepoCommitUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<ReviewSuccessState | null>(
    null,
  );

  async function submitReview() {
    if (inputMode === "snippet" && !codeSnippet.trim()) {
      setErrorMessage("Tempelkan potongan kode implementasi terlebih dahulu.");
      return;
    }
    if (inputMode === "commit" && !repoCommitUrl.trim()) {
      setErrorMessage("Masukkan URL commit GitHub terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    setRateLimited(false);
    setErrorMessage(null);

    try {
      const payload =
        inputMode === "snippet"
          ? { trackId, moduleId, codeSnippet }
          : { trackId, moduleId, repoCommitUrl };

      const response = await fetch("/api/labs/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as Partial<
        ReviewSuccessState & { ok: boolean; error: string; code: string }
      >;

      if (!response.ok || !data.ok || !data.feedback) {
        setRateLimited(response.status === 429 || data.code === "RATE_LIMIT");
        setErrorMessage(
          data.error ?? "Gagal mengevaluasi kiriman kode praktikum.",
        );
        return;
      }

      setLatestResult({
        passed: Boolean(data.passed),
        feedback: data.feedback,
        interviewQuestions: data.interviewQuestions ?? [],
        unlockedModuleId: data.unlockedModuleId ?? null,
        masteryScore: data.masteryScore ?? 0,
        skillStatus: data.skillStatus ?? "learning",
        capped: Boolean(data.capped),
        truncated: Boolean(data.truncated),
        skippedFiles: data.skippedFiles ?? [],
      });
      router.refresh();
    } catch {
      setErrorMessage("Gagal terhubung ke server Code Review.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitReview();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Kirim Lab Submission untuk Evaluasi AI
          </CardTitle>
          <CardDescription>
            Kirim potongan kode atau URL commit GitHub. Lockfile dan binary
            disaring otomatis (maks. 12.000 karakter) dan setiap review akan
            melahirkan 2 Kartu Interview baru.
          </CardDescription>
        </CardHeader>

        <CardContent>
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
                    onClick={() => void submitReview()}
                    className="gap-1 bg-background text-foreground"
                  >
                    <RefreshCw className="size-3" />
                    <span>Coba Review Ulang</span>
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Tabs
              value={inputMode}
              onValueChange={(value) => {
                if (value === "snippet" || value === "commit") {
                  setInputMode(value);
                  setErrorMessage(null);
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2 sm:w-80">
                <TabsTrigger value="snippet">Potongan Kode</TabsTrigger>
                <TabsTrigger value="commit">URL Commit GitHub</TabsTrigger>
              </TabsList>

              <TabsContent value="snippet" className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="lab-code-snippet" className="font-medium">
                    Tempel Kode Implementasi ({skillName})
                  </label>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {codeSnippet.length.toLocaleString("id-ID")} karakter
                  </span>
                </div>
                <Textarea
                  id="lab-code-snippet"
                  rows={10}
                  value={codeSnippet}
                  onChange={(event) => setCodeSnippet(event.target.value)}
                  placeholder="Tempel implementasi fungsi, query SQL, atau endpoint Anda di sini..."
                  className="font-mono text-xs leading-relaxed"
                />
              </TabsContent>

              <TabsContent value="commit" className="mt-3 space-y-1.5">
                <label
                  htmlFor="lab-commit-url"
                  className="flex items-center gap-1.5 text-xs font-medium"
                >
                  <GitCommitHorizontal className="size-3.5" />
                  <span>URL Commit GitHub Publik</span>
                </label>
                <Input
                  id="lab-commit-url"
                  value={repoCommitUrl}
                  onChange={(event) => setRepoCommitUrl(event.target.value)}
                  placeholder="https://github.com/username/capstone-repo/commit/abc1234..."
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Sistem mengambil diff commit via GitHub REST API (timeout 4
                  detik) dan menyaring lockfile/gambar secara otomatis.
                </p>
              </TabsContent>
            </Tabs>

            <Button type="submit" disabled={submitting} className="gap-1.5">
              <Send className="size-4" />
              <span>
                {submitting
                  ? "Mengevaluasi Acceptance Criteria..."
                  : "Kirim & Evaluasi Kode"}
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {latestResult ? (
        <Card
          className={
            latestResult.passed
              ? "border-[color-mix(in_oklab,var(--status-mastered)_45%,transparent)]"
              : "border-[color-mix(in_oklab,var(--status-learning)_45%,transparent)]"
          }
        >
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {latestResult.passed ? (
                  <>
                    <CheckCircle2 className="size-4 text-[var(--status-mastered)]" />
                    <span>Lulus Acceptance Criteria</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 text-[var(--status-learning)]" />
                    <span>Perlu Revisi Sebelum Lulus</span>
                  </>
                )}
              </CardTitle>

              <Badge
                variant={latestResult.skillStatus}
                className="font-mono tabular-nums"
              >
                Mastery {skillName}: {latestResult.masteryScore}% (
                {SKILL_STATUS_LABELS[latestResult.skillStatus]})
              </Badge>
            </div>
            <CardDescription>{latestResult.feedback.summary}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            {latestResult.truncated || latestResult.skippedFiles.length > 0 ? (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
                {latestResult.skippedFiles.length > 0 ? (
                  <span>
                    File dilewati:{" "}
                    <code className="font-mono">
                      {latestResult.skippedFiles.join(", ")}
                    </code>
                    .{" "}
                  </span>
                ) : null}
                {latestResult.truncated
                  ? "Diff dipangkas ke maks. 12.000 karakter."
                  : null}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
                <div className="font-semibold text-[var(--status-mastered)]">
                  Kriteria Terpenuhi
                </div>
                <ul className="list-disc space-y-1 pl-4">
                  {latestResult.feedback.criteria_met.length === 0 ? (
                    <li className="text-muted-foreground">Belum ada.</li>
                  ) : (
                    latestResult.feedback.criteria_met.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))
                  )}
                </ul>
              </div>

              <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
                <div className="font-semibold text-[var(--status-learning)]">
                  Saran Perbaikan
                </div>
                <ul className="list-disc space-y-1 pl-4">
                  {latestResult.feedback.improvements.length === 0 ? (
                    <li className="text-muted-foreground">Tidak ada.</li>
                  ) : (
                    latestResult.feedback.improvements.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  <MessageSquare className="size-3.5" />
                  <span>
                    2 Kartu Interview Baru Ditambahkan (Hasil Lab Review)
                  </span>
                </span>
                <Link href="/interview">
                  <Button variant="outline" size="xs">
                    Latihan di Interview Lab
                  </Button>
                </Link>
              </div>
              <ol className="list-decimal space-y-1 pl-4">
                {latestResult.interviewQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ol>
            </div>

            {latestResult.unlockedModuleId ? (
              <Link
                href={`/tracks/${trackId}/modules/${latestResult.unlockedModuleId}`}
              >
                <Button size="sm">Lanjut ke Modul Berikutnya</Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span>Riwayat Lab Submission</span>
            <Badge variant="mono" className="tabular-nums">
              {initialSubmissions.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {initialSubmissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-5 text-center text-sm text-muted-foreground">
              Belum ada riwayat evaluasi kode untuk modul ini.
            </div>
          ) : (
            <div className="space-y-3">
              {initialSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={sub.passed ? "mastered" : "learning"}>
                        {sub.passed ? "Passed" : "Perlu Revisi"}
                      </Badge>
                      {sub.repo_commit_url ? (
                        <a
                          href={toSafeExternalHref(sub.repo_commit_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-foreground underline-offset-4 hover:underline"
                        >
                          Commit GitHub
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          Potongan Kode
                        </span>
                      )}
                    </div>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {new Date(sub.submitted_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {sub.feedback ? (
                    <p className="text-xs text-muted-foreground">
                      {sub.feedback.summary}
                    </p>
                  ) : null}

                  {sub.interview_questions.length > 0 ? (
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Pertanyaan Interview:{" "}
                      </span>
                      {sub.interview_questions.join(" • ")}
                    </div>
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
