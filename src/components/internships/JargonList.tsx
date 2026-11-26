"use client";

import { BookmarkPlus, Check } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveToNoteAction } from "@/actions/notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JargonEntry } from "@/types/schemas";

export function JargonList({
  internshipTitle,
  companyName,
  entries,
  defaultSkillId,
}: {
  internshipTitle: string;
  companyName: string;
  entries: JargonEntry[];
  defaultSkillId?: string | null;
}) {
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSaveToNote(entry: JargonEntry) {
    setErrorMessage(null);
    setActiveTerm(entry.term);

    startTransition(async () => {
      const result = await saveToNoteAction({
        title: `Glosarium JD: ${internshipTitle}`,
        term: entry.term,
        definition: `${entry.definition}\n\nKonteks JD: ${entry.context}`,
        sourceLabel: companyName
          ? `${internshipTitle} — ${companyName}`
          : internshipTitle,
        skillId: defaultSkillId ?? null,
      });

      setActiveTerm(null);

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setSavedNotes((prev) => ({
        ...prev,
        [entry.term]: result.data.noteId,
      }));
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Glosarium Istilah JD (JargonGlossary)
            </CardTitle>
            <CardDescription>
              Simpan istilah penting ke Smart Notes dalam format{" "}
              <code className="font-mono text-xs">{"{{istilah}}"}</code> untuk
              kuis Cloze.
            </CardDescription>
          </div>
          <Badge variant="secondary">{entries.length} Istilah</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada jargon khusus yang diekstrak dari lowongan ini.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {entries.map((entry) => {
              const savedNoteId = savedNotes[entry.term];
              const isSaving = isPending && activeTerm === entry.term;

              return (
                <div
                  key={entry.term}
                  className="flex flex-col justify-between gap-3 rounded-lg border p-3.5"
                >
                  <div className="space-y-1.5">
                    <div className="font-semibold text-sm">{entry.term}</div>
                    <p className="text-xs leading-relaxed text-foreground/90">
                      {entry.definition}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Konteks: {entry.context}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t pt-2.5">
                    {savedNoteId ? (
                      <Link href={`/notes/${savedNoteId}`}>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="gap-1.5"
                        >
                          <Check className="size-3.5 text-emerald-600" />
                          <span>Tersimpan • Buka Catatan</span>
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={isPending}
                        onClick={() => handleSaveToNote(entry)}
                        className="gap-1.5"
                      >
                        <BookmarkPlus className="size-3.5" />
                        <span>
                          {isSaving ? "Menyimpan..." : "Save to Note"}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
