"use client";

import {
  CheckCircle2,
  Eye,
  HelpCircle,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  evaluateClozeAnswer,
  parseClozeMarkdown,
  type ClozeItem,
} from "@/lib/cloze-parser";
import type { Note, QuizAttempt, Skill, SkillStatus } from "@/types/database";

type QuizNoteItem = Pick<Note, "id" | "title" | "content_md" | "skill_id">;
type QuizSkillItem = Pick<
  Skill,
  "id" | "name" | "slug" | "mastery_score" | "status"
>;
type QuizAttemptItem = Pick<
  QuizAttempt,
  | "id"
  | "skill_id"
  | "source_type"
  | "score"
  | "total_questions"
  | "correct_answers"
  | "attempted_at"
>;

type SubmissionResult = {
  score: number;
  correctCount: number;
  totalCount: number;
  masteryScore: number | null;
  status: SkillStatus | null;
  capped: boolean;
  savedToSkill: boolean;
};

const STATUS_LABELS: Record<SkillStatus, string> = {
  gap: "Gap",
  learning: "Learning",
  mastered: "Mastered",
};

function renderPromptInline(
  text: string,
  itemMap: Map<string, ClozeItem>,
  grading: Map<number, boolean> | null,
  answers: Record<number, string>,
  keyPrefix: string,
): ReactNode[] {
  const parts = text.split(/(___CLOZE_\d+___|``[^`]+``|`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.filter(Boolean).map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith("___CLOZE_") && part.endsWith("___")) {
      const item = itemMap.get(part);
      if (item) {
        const isCorrect = grading?.get(item.index);
        const typed = answers[item.index]?.trim();
        const badgeStyle =
          isCorrect === true
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : isCorrect === false
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-primary/40 bg-primary/10 text-primary";

        return (
          <span
            key={key}
            className={`mx-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs font-medium ${badgeStyle}`}
          >
            <span>#{item.index}</span>
            {grading ? (
              <span>: {item.answer}</span>
            ) : typed ? (
              <span className="max-w-36 truncate text-foreground/80">
                ({typed})
              </span>
            ) : (
              <span>[ ____ ]</span>
            )}
          </span>
        );
      }
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      const inner = part.startsWith("``") ? part.slice(2, -2) : part.slice(1, -1);
      return (
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
        >
          {renderPromptInline(
            inner,
            itemMap,
            grading,
            answers,
            `${key}-code`,
          )}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}

function renderPromptBlocks(
  renderedPrompt: string,
  itemMap: Map<string, ClozeItem>,
  grading: Map<number, boolean> | null,
  answers: Record<number, string>,
): ReactNode[] {
  const lines = renderedPrompt.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      const marker = trimmed.startsWith("```") ? "```" : "~~~";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={`code-${i}`}
          className="overflow-x-auto rounded-lg border bg-muted/60 p-3 font-mono text-xs leading-relaxed"
        >
          <code>
            {renderPromptInline(
              codeLines.join("\n"),
              itemMap,
              grading,
              answers,
              `fence-${i}`,
            )}
          </code>
        </pre>,
      );
      continue;
    }

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith("#")) {
      const level = trimmed.match(/^#+/)?.[0].length ?? 1;
      const content = trimmed.slice(level).trim();
      const cls =
        level === 1
          ? "pt-1 text-base font-bold"
          : "pt-1.5 text-sm font-semibold";
      blocks.push(
        <p key={`h-${i}`} className={cls}>
          {renderPromptInline(content, itemMap, grading, answers, `h-${i}`)}
        </p>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={`q-${i}`}
          className="border-l-2 border-primary/40 pl-3 text-xs text-muted-foreground italic"
        >
          {renderPromptInline(
            trimmed.slice(2),
            itemMap,
            grading,
            answers,
            `q-${i}`,
          )}
        </blockquote>,
      );
      i++;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed">
        {renderPromptInline(line, itemMap, grading, answers, `p-${i}`)}
      </p>,
    );
    i++;
  }

  return blocks;
}

export function ClozeQuizRunner({
  notes,
  skills,
  recentAttempts,
  initialNoteId,
}: {
  notes: QuizNoteItem[];
  skills: QuizSkillItem[];
  recentAttempts: QuizAttemptItem[];
  initialNoteId?: string | null;
}) {
  const router = useRouter();
  const [skillFilter, setSkillFilter] = useState("all");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>(
    {},
  );
  const [grading, setGrading] = useState<Map<number, boolean> | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const skillMap = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill])),
    [skills],
  );

  const quizNotes = useMemo(
    () =>
      notes
        .map((note) => ({
          note,
          parsed: parseClozeMarkdown(note.content_md),
        }))
        .filter((entry) => entry.parsed.clozeCount > 0),
    [notes],
  );

  const filteredNotes = useMemo(() => {
    if (skillFilter === "all") return quizNotes;
    if (skillFilter === "unassigned") {
      return quizNotes.filter((entry) => entry.note.skill_id === null);
    }
    return quizNotes.filter((entry) => entry.note.skill_id === skillFilter);
  }, [quizNotes, skillFilter]);

  const defaultNoteId = useMemo(() => {
    if (
      initialNoteId &&
      quizNotes.some((entry) => entry.note.id === initialNoteId)
    ) {
      return initialNoteId;
    }
    return quizNotes[0]?.note.id ?? "";
  }, [initialNoteId, quizNotes]);

  const [selectedNoteId, setSelectedNoteId] = useState(defaultNoteId);

  const activeEntry = useMemo(
    () =>
      filteredNotes.find((entry) => entry.note.id === selectedNoteId) ??
      filteredNotes[0] ??
      null,
    [filteredNotes, selectedNoteId],
  );

  const itemMap = useMemo(
    () =>
      new Map(
        (activeEntry?.parsed.items ?? []).map((item) => [
          item.placeholder,
          item,
        ]),
      ),
    [activeEntry],
  );

  function resetAttemptState() {
    setAnswers({});
    setRevealedHints({});
    setGrading(null);
    setResult(null);
    setErrorMessage(null);
  }

  function handleSelectNote(nextId: string | null) {
    if (!nextId) return;
    setSelectedNoteId(nextId);
    resetAttemptState();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEntry) return;

    setErrorMessage(null);
    const items = activeEntry.parsed.items;
    const nextGrading = new Map<number, boolean>();
    let correctCount = 0;

    for (const item of items) {
      const ok = evaluateClozeAnswer(
        answers[item.index] ?? "",
        item.answer,
        item.isCodeCloze,
      );
      nextGrading.set(item.index, ok);
      if (ok) correctCount++;
    }

    setGrading(nextGrading);

    const linkedSkillId = activeEntry.note.skill_id;
    const localScore = Math.round((correctCount / items.length) * 100);

    if (!linkedSkillId) {
      setResult({
        score: localScore,
        correctCount,
        totalCount: items.length,
        masteryScore: null,
        status: null,
        capped: false,
        savedToSkill: false,
      });
      return;
    }

    startTransition(async () => {
      const response = await submitQuizAttemptAction({
        skillId: linkedSkillId,
        sourceType: "note_cloze",
        totalQuestions: items.length,
        correctAnswers: correctCount,
      });

      if (!response.ok) {
        setErrorMessage(response.error);
        return;
      }

      setResult({
        score: response.data.score,
        correctCount,
        totalCount: items.length,
        masteryScore: response.data.masteryScore,
        status: response.data.status,
        capped: response.data.capped,
        savedToSkill: true,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {quizNotes.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum Ada Soal Cloze</CardTitle>
            <CardDescription>
              Buat atau edit catatan di Smart Notes dan tandai istilah penting
              menggunakan{" "}
              <code className="font-mono text-xs">{"{{jawaban}}"}</code> untuk
              mulai berlatih active recall.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/notes">
              <Button size="sm">Buka Smart Notes</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={skillFilter}
              onValueChange={(value) => {
                setSkillFilter(value ?? "all");
                resetAttemptState();
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue>
                  {skillFilter === "all"
                    ? "Semua Skill"
                    : skillFilter === "unassigned"
                      ? "Tanpa Skill"
                      : (skillMap.get(skillFilter)?.name ?? "Filter Skill")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Skill</SelectItem>
                <SelectItem value="unassigned">Tanpa Skill</SelectItem>
                {skills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={activeEntry?.note.id ?? ""}
              onValueChange={handleSelectNote}
              disabled={filteredNotes.length === 0}
            >
              <SelectTrigger className="w-72">
                <SelectValue>
                  {activeEntry
                    ? `${activeEntry.note.title} (${activeEntry.parsed.clozeCount} soal)`
                    : "Pilih catatan ber-cloze"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filteredNotes.map((entry) => (
                  <SelectItem key={entry.note.id} value={entry.note.id}>
                    {entry.note.title} ({entry.parsed.clozeCount} soal)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeEntry?.note.skill_id ? (
              <Badge variant="secondary">
                Skill: {skillMap.get(activeEntry.note.skill_id)?.name ?? "Terkait"}
              </Badge>
            ) : (
              <Badge variant="outline">Catatan tanpa Skill</Badge>
            )}
          </div>

          {!activeEntry ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada catatan ber-cloze untuk filter skill ini.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="flex flex-col">
                <CardHeader className="border-b pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      Konteks Catatan: {activeEntry.note.title}
                    </CardTitle>
                    <Link href={`/notes/${activeEntry.note.id}`}>
                      <Button variant="ghost" size="xs">
                        Edit Catatan
                      </Button>
                    </Link>
                  </div>
                  <CardDescription>
                    Isi bagian bernomor <span className="font-mono">#1..#{activeEntry.parsed.clozeCount}</span> di panel kanan berdasarkan konteks ini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-[540px] space-y-2.5 overflow-y-auto pt-4">
                  {renderPromptBlocks(
                    activeEntry.parsed.renderedPrompt,
                    itemMap,
                    grading,
                    answers,
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HelpCircle className="size-4" />
                    <span>Lembar Jawaban ({activeEntry.parsed.clozeCount} Soal)</span>
                  </CardTitle>
                  <CardDescription>
                    Jawaban prosa bersifat case-insensitive; jawaban blok kode mengikuti casing kode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMessage ? (
                      <div
                        role="alert"
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                      >
                        {errorMessage}
                      </div>
                    ) : null}

                    {result ? (
                      <div className="space-y-1.5 rounded-lg border bg-muted/40 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            Skor Kuis: {result.score}% ({result.correctCount}/
                            {result.totalCount} benar)
                          </span>
                          {result.savedToSkill && result.masteryScore !== null ? (
                            <Badge variant="default">
                              Mastery: {result.masteryScore}% (
                              {result.status ? STATUS_LABELS[result.status] : ""})
                            </Badge>
                          ) : null}
                        </div>
                        {result.savedToSkill ? (
                          <p className="text-muted-foreground">
                            Percobaan tersimpan ke{" "}
                            <span className="font-medium">quiz_attempts</span> dan
                            Mastery Score skill diperbarui.
                            {result.capped
                              ? " Skor dibatasi maks. 65% karena baru memiliki 1 sinyal (Quiz); selesaikan Lab/Interview untuk menembus 80%+."
                              : ""}
                          </p>
                        ) : (
                          <p className="text-muted-foreground">
                            Skor dihitung secara lokal. Tautkan catatan ini ke sebuah
                            Skill di Smart Notes agar skor tercatat dan menaikkan
                            Mastery Score.
                          </p>
                        )}
                      </div>
                    ) : null}

                    <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
                      {activeEntry.parsed.items.map((item) => {
                        const isCorrect = grading?.get(item.index);
                        const hintVisible = Boolean(revealedHints[item.index]);

                        return (
                          <div
                            key={item.index}
                            className="space-y-1.5 rounded-lg border p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold">
                                  Soal #{item.index}
                                </span>
                                {item.isCodeCloze ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    Kode (Case-Sensitive)
                                  </Badge>
                                ) : null}
                              </div>

                              {item.hint ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  className="gap-1 text-xs"
                                  onClick={() =>
                                    setRevealedHints((prev) => ({
                                      ...prev,
                                      [item.index]: !prev[item.index],
                                    }))
                                  }
                                >
                                  <Eye className="size-3" />
                                  <span>
                                    {hintVisible
                                      ? "Tutup Petunjuk"
                                      : "Lihat Petunjuk"}
                                  </span>
                                </Button>
                              ) : null}
                            </div>

                            {item.hint && hintVisible ? (
                              <p className="rounded bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                                Petunjuk: {item.hint}
                              </p>
                            ) : null}

                            <Input
                              value={answers[item.index] ?? ""}
                              disabled={grading !== null || isPending}
                              onChange={(event) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [item.index]: event.target.value,
                                }))
                              }
                              placeholder={`Ketik jawaban #${item.index}...`}
                              className={
                                item.isCodeCloze ? "font-mono text-xs" : "text-sm"
                              }
                            />

                            {grading !== null ? (
                              <div className="flex items-center gap-1.5 text-xs">
                                {isCorrect ? (
                                  <>
                                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                                      Benar ({item.answer})
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="size-3.5 text-destructive" />
                                    <span className="text-destructive">
                                      Kunci:{" "}
                                      <code className="rounded bg-muted px-1 py-0.5 font-mono">
                                        {item.answer}
                                      </code>
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="submit"
                        disabled={isPending || grading !== null}
                        className="gap-1.5"
                      >
                        <Sparkles className="size-4" />
                        <span>
                          {isPending ? "Menyimpan..." : "Periksa & Simpan Skor"}
                        </span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetAttemptState}
                        disabled={isPending}
                        className="gap-1.5"
                      >
                        <RotateCcw className="size-4" />
                        <span>Ulangi Kuis</span>
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Riwayat Kuis Terbaru</CardTitle>
          <CardDescription>
            Setiap kuis pada catatan bertaut Skill memengaruhi rata-rata 3 skor
            terbaru di rumus Mastery Score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada riwayat kuis yang tercatat.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {recentAttempts.map((attempt) => {
                const skill = skillMap.get(attempt.skill_id);
                return (
                  <div
                    key={attempt.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {skill?.name ?? "Skill"}
                      </span>
                      <Badge variant="outline" className="text-[11px]">
                        {attempt.source_type === "note_cloze"
                          ? "Note Cloze"
                          : "Module Drill"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {attempt.correct_answers}/{attempt.total_questions} benar
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <Badge
                        variant={attempt.score >= 70 ? "default" : "secondary"}
                      >
                        {attempt.score}%
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(attempt.attempted_at).toLocaleDateString(
                          "id-ID",
                          {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
