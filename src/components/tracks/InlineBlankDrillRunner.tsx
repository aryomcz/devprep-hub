"use client";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { submitQuizAttemptAction } from "@/actions/quiz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { evaluateClozeAnswer } from "@/lib/cloze-parser";
import type { SkillStatus } from "@/types/database";
import type { WarmupDrill } from "@/types/schemas";

const SYNTAX_TOKEN_REGEX =
  /(\/\/[^\n]*|--[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|async|await|return|import|from|export|type|interface|if|else|for|while|class|new|try|catch|throw|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ON|PRIMARY|KEY|NOT|NULL|REFERENCES|DEFAULT|JOIN|ORDER|BY|GROUP|func|package|struct|defer|go|pub|fn|impl|match|use)\b|\b\d+(?:\.\d+)?\b)/g;

const KEYWORD_REGEX =
  /^(?:const|let|var|function|async|await|return|import|from|export|type|interface|if|else|for|while|class|new|try|catch|throw|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ON|PRIMARY|KEY|NOT|NULL|REFERENCES|DEFAULT|JOIN|ORDER|BY|GROUP|func|package|struct|defer|go|pub|fn|impl|match|use)$/;

const STATUS_LABELS: Record<SkillStatus, string> = {
  gap: "Gap",
  learning: "Learning",
  mastered: "Mastered",
};

function highlightSegment(text: string, keyPrefix: string): ReactNode {
  const parts = text.split(SYNTAX_TOKEN_REGEX);
  return (
    <Fragment key={keyPrefix}>
      {parts.map((part, idx) => {
        if (!part) return null;
        const key = `${keyPrefix}-${idx}`;

        if (
          part.startsWith("//") ||
          part.startsWith("--") ||
          part.startsWith("#")
        ) {
          return (
            <span key={key} className="text-muted-foreground italic">
              {part}
            </span>
          );
        }

        if (
          (part.startsWith('"') && part.endsWith('"')) ||
          (part.startsWith("'") && part.endsWith("'"))
        ) {
          return (
            <span
              key={key}
              className="text-emerald-700 dark:text-emerald-300"
            >
              {part}
            </span>
          );
        }

        if (/^\d+(?:\.\d+)?$/.test(part)) {
          return (
            <span key={key} className="text-amber-700 dark:text-amber-300">
              {part}
            </span>
          );
        }

        if (KEYWORD_REGEX.test(part)) {
          return (
            <span
              key={key}
              className="font-semibold text-blue-700 dark:text-blue-300"
            >
              {part}
            </span>
          );
        }

        return <Fragment key={key}>{part}</Fragment>;
      })}
    </Fragment>
  );
}

type DrillSubmitSummary = {
  score: number;
  correctCount: number;
  totalCount: number;
  masteryScore: number;
  status: SkillStatus;
  capped: boolean;
};

export function InlineBlankDrillRunner({
  drills,
  skillId,
  skillName,
}: {
  drills: WarmupDrill[];
  skillId: string;
  skillName: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grading, setGrading] = useState<Record<string, boolean> | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [summary, setSummary] = useState<DrillSubmitSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalBlanks = useMemo(
    () => drills.reduce((acc, drill) => acc + drill.blanks.length, 0),
    [drills],
  );

  function handleReset() {
    setAnswers({});
    setGrading(null);
    setSummary(null);
    setErrorMessage(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (totalBlanks === 0) return;

    setErrorMessage(null);
    const nextGrading: Record<string, boolean> = {};
    let correctCount = 0;

    drills.forEach((drill, drillIdx) => {
      for (const blank of drill.blanks) {
        const key = `${drillIdx}:${blank.id}`;
        const ok = evaluateClozeAnswer(answers[key] ?? "", blank.answer, false);
        nextGrading[key] = ok;
        if (ok) correctCount++;
      }
    });

    setGrading(nextGrading);

    startTransition(async () => {
      const result = await submitQuizAttemptAction({
        skillId,
        sourceType: "module_drill",
        totalQuestions: totalBlanks,
        correctAnswers: correctCount,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setSummary({
        score: result.data.score,
        correctCount,
        totalCount: totalBlanks,
        masteryScore: result.data.masteryScore,
        status: result.data.status,
        capped: result.data.capped,
      });
      router.refresh();
    });
  }

  if (drills.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Belum Ada Warm-up Drill</CardTitle>
          <CardDescription>
            Modul ini belum memiliki latihan rumpang.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {drills.length} latihan • {totalBlanks} slot kode (tekan{" "}
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
            Tab
          </kbd>{" "}
          untuk berpindah antar slot)
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setShowHints((prev) => !prev)}
          className="gap-1.5"
        >
          {showHints ? (
            <>
              <EyeOff className="size-3.5" />
              <span>Sembunyikan Petunjuk</span>
            </>
          ) : (
            <>
              <Eye className="size-3.5" />
              <span>Tampilkan Petunjuk</span>
            </>
          )}
        </Button>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">
              Skor Drill: {summary.score}% ({summary.correctCount}/
              {summary.totalCount} benar)
            </span>
            <Badge variant="default">
              Mastery {skillName}: {summary.masteryScore}% (
              {STATUS_LABELS[summary.status]})
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Tercatat sebagai{" "}
            <code className="font-mono">module_drill</code> di riwayat kuis.
            {summary.capped
              ? " Skor dibatasi maks. 65% sampai Anda menyelesaikan sinyal Lab atau Interview."
              : ""}
          </p>
        </div>
      ) : null}

      {drills.map((drill, drillIdx) => {
        const blankMap = new Map(
          drill.blanks.map((blank) => [`___${blank.id}___`, blank]),
        );
        const tokens = drill.code_template.split(/(___[A-Za-z0-9_-]+___)/g);

        return (
          <Card key={`${drillIdx}-${drill.title}`}>
            <CardHeader className="border-b pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">
                  {drillIdx + 1}. {drill.title}
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {drill.language}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
              <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3.5 font-mono text-xs leading-7">
                <code>
                  {tokens.map((token, tokenIdx) => {
                    const blank = blankMap.get(token);
                    if (!blank) {
                      return highlightSegment(
                        token,
                        `d${drillIdx}-t${tokenIdx}`,
                      );
                    }

                    const fieldKey = `${drillIdx}:${blank.id}`;
                    const value = answers[fieldKey] ?? "";
                    const isCorrect = grading?.[fieldKey];
                    const widthCh = Math.max(
                      10,
                      Math.min(32, Math.max(value.length, blank.answer.length) + 2),
                    );

                    const borderClass =
                      isCorrect === true
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : isCorrect === false
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-primary/50 bg-background text-foreground focus:border-primary";

                    return (
                      <span
                        key={fieldKey}
                        className="mx-0.5 inline-flex items-center gap-1 align-baseline"
                      >
                        <input
                          type="text"
                          value={value}
                          disabled={grading !== null || isPending}
                          autoComplete="off"
                          spellCheck={false}
                          aria-label={`${drill.title} ${blank.id}`}
                          placeholder={blank.id}
                          style={{ width: `${widthCh}ch` }}
                          onChange={(event) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [fieldKey]: event.target.value,
                            }))
                          }
                          className={`rounded border px-1.5 py-0.5 font-mono text-xs outline-none transition-colors ${borderClass}`}
                        />
                        {isCorrect === true ? (
                          <CheckCircle2 className="inline size-3.5 text-emerald-600" />
                        ) : isCorrect === false ? (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-destructive">
                            <XCircle className="inline size-3" />
                            <span>({blank.answer})</span>
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </code>
              </pre>

              {showHints && drill.blanks.some((b) => b.hint) ? (
                <div className="space-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {drill.blanks
                    .filter((blank) => blank.hint)
                    .map((blank) => (
                      <div key={blank.id}>
                        <span className="font-mono font-semibold text-foreground">
                          {blank.id}:
                        </span>{" "}
                        {blank.hint}
                      </div>
                    ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          disabled={isPending || grading !== null}
          className="gap-1.5"
        >
          <Sparkles className="size-4" />
          <span>
            {isPending ? "Menyimpan Skor..." : "Periksa & Simpan Skor Drill"}
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleReset}
          className="gap-1.5"
        >
          <RotateCcw className="size-4" />
          <span>Ulangi Drill</span>
        </Button>
      </div>
    </form>
  );
}
