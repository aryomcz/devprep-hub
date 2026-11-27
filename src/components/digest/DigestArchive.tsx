"use client";

import { BookmarkPlus, Check, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { markDigestReadAction } from "@/actions/digest";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toSafeExternalHref } from "@/lib/safe-url";
import type { DigestSource } from "@/types/database";

export type DigestListItem = {
  id: string;
  source: DigestSource;
  title: string;
  url: string;
  matched_skill_id: string | null;
  is_read: boolean;
  digest_date: string;
};

export function DigestArchive({
  digests,
  skills,
}: {
  digests: DigestListItem[];
  skills: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [skillFilter, setSkillFilter] = useState("all");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const skillMap = useMemo(
    () => new Map(skills.map((s) => [s.id, s.name])),
    [skills],
  );

  const filtered = useMemo(() => {
    return digests.filter((item) => {
      if (skillFilter !== "all" && item.matched_skill_id !== skillFilter) {
        return false;
      }
      if (readFilter === "unread" && item.is_read) return false;
      if (readFilter === "read" && !item.is_read) return false;
      return true;
    });
  }, [digests, readFilter, skillFilter]);

  function handleToggleRead(id: string, nextRead: boolean) {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await markDigestReadAction(id, nextRead);
      if (!res.ok) {
        setErrorMessage(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSaveToNote(item: DigestListItem) {
    setErrorMessage(null);
    const skillName = item.matched_skill_id
      ? skillMap.get(item.matched_skill_id)
      : undefined;

    startTransition(async () => {
      const res = await saveToNoteAction({
        title: skillName ? `Catatan ${skillName}` : "Ringkasan Daily Digest",
        term: (skillName ?? item.title).slice(0, 200),
        definition: `Ringkasan bacaan dari ${item.source === "devto" ? "Dev.to" : "Hacker News"}: ${item.title}\n\nTautan: ${item.url}`,
        sourceLabel: `${item.source} (${item.digest_date})`,
        skillId: item.matched_skill_id,
      });
      if (!res.ok) {
        setErrorMessage(res.error);
        return;
      }
      setSavedNotes((prev) => ({ ...prev, [item.id]: res.data.noteId }));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={skillFilter}
          onValueChange={(val) => setSkillFilter(val ?? "all")}
        >
          <SelectTrigger className="w-48" aria-label="Filter skill digest">
            <SelectValue>
              {skillFilter === "all"
                ? "Semua Skill"
                : (skillMap.get(skillFilter) ?? "Skill")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Skill</SelectItem>
            {skills.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={readFilter}
          onValueChange={(val) => {
            if (val === "all" || val === "unread" || val === "read") {
              setReadFilter(val);
            }
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter status baca digest">
            <SelectValue>
              {readFilter === "all"
                ? "Semua Status"
                : readFilter === "unread"
                  ? "Belum Dibaca"
                  : "Sudah Dibaca"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="unread">Belum Dibaca</SelectItem>
            <SelectItem value="read">Sudah Dibaca</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <Card className="border-dashed bg-card/60">
          <CardHeader className="py-8 text-center">
            <CardTitle className="text-base">Belum Ada Daily Digest</CardTitle>
            <CardDescription className="mx-auto max-w-md">
              Artikel teknis harian otomatis ditarik oleh Vercel Cron (Dev.to
              &amp; Hacker News) untuk skill berstatus Gap atau Learning.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const skillName = item.matched_skill_id
              ? skillMap.get(item.matched_skill_id)
              : null;
            const savedNoteId = savedNotes[item.id];

            return (
              <Card
                key={item.id}
                className={
                  item.is_read
                    ? "opacity-75 hover:border-foreground/20"
                    : "hover:border-foreground/20"
                }
              >
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="mono" className="text-[10px] uppercase">
                        {item.source === "devto" ? "Dev.to" : "Hacker News"}
                      </Badge>
                      {skillName ? (
                        <Badge variant="secondary">{skillName}</Badge>
                      ) : null}
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {item.digest_date}
                      </span>
                      {item.is_read ? (
                        <Badge variant="outline">Sudah Dibaca</Badge>
                      ) : null}
                    </div>

                    <a
                      href={toSafeExternalHref(item.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={isPending}
                      onClick={() => handleToggleRead(item.id, !item.is_read)}
                      className="gap-1"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>
                        {item.is_read ? "Tandai Belum Baca" : "Tandai Dibaca"}
                      </span>
                    </Button>

                    {savedNoteId ? (
                      <Link href={`/notes/${savedNoteId}`}>
                        <Button variant="outline" size="xs" className="gap-1">
                          <Check className="size-3.5 text-[var(--status-mastered)]" />
                          <span>Buka Catatan</span>
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        disabled={isPending}
                        onClick={() => handleSaveToNote(item)}
                        className="gap-1"
                      >
                        <BookmarkPlus className="size-3.5" />
                        <span>Save to Note</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
