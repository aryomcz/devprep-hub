"use client";

import { ArrowLeft, Eye, EyeOff, Printer } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseClozeMarkdown, type ClozeItem } from "@/lib/cloze-parser";
import type { Note } from "@/types/database";

function renderPrintInline(
  text: string,
  itemMap: Map<string, ClozeItem>,
  showAnswers: boolean,
  keyPrefix: string,
): ReactNode[] {
  const parts = text.split(/(___CLOZE_\d+___|``[^`]+``|`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.filter(Boolean).map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith("___CLOZE_") && part.endsWith("___")) {
      const item = itemMap.get(part);
      if (item) {
        return showAnswers ? (
          <span
            key={key}
            className="mx-0.5 inline rounded border border-neutral-400 bg-neutral-100 px-1 py-0.2 font-semibold text-neutral-900"
          >
            {item.answer}
          </span>
        ) : (
          <span
            key={key}
            className="mx-0.5 inline-block border-b border-neutral-800 px-2 font-mono text-[10px] text-neutral-600"
          >
            #{item.index}
            {item.hint ? ` (${item.hint})` : " ________"}
          </span>
        );
      }
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      const inner = part.startsWith("``") ? part.slice(2, -2) : part.slice(1, -1);
      return (
        <code
          key={key}
          className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] text-neutral-900"
        >
          {renderPrintInline(inner, itemMap, showAnswers, `${key}-code`)}
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

function renderPrintBlocks(
  renderedPrompt: string,
  itemMap: Map<string, ClozeItem>,
  showAnswers: boolean,
): ReactNode[] {
  const lines = renderedPrompt.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      const marker = trimmed.startsWith("```") ? "```" : "~~~";
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <div key={`code-${i}`} className="print-keep-together my-1.5">
          {lang ? (
            <div className="text-[9px] font-semibold uppercase text-neutral-500">
              {lang}
            </div>
          ) : null}
          <pre className="overflow-x-hidden whitespace-pre-wrap break-words rounded border border-neutral-300 bg-neutral-50 p-2 font-mono text-[8.5pt] leading-snug text-neutral-900">
            <code>
              {renderPrintInline(
                codeLines.join("\n"),
                itemMap,
                showAnswers,
                `fence-${i}`,
              )}
            </code>
          </pre>
        </div>,
      );
      continue;
    }

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed === "---" || trimmed === "***") {
      blocks.push(<hr key={`hr-${i}`} className="my-2 border-neutral-300" />);
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3
          key={`h3-${i}`}
          className="mt-2.5 mb-1 text-[10pt] font-semibold text-neutral-900"
        >
          {renderPrintInline(
            trimmed.slice(4),
            itemMap,
            showAnswers,
            `h3-${i}`,
          )}
        </h3>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2
          key={`h2-${i}`}
          className="mt-3 mb-1 border-b border-neutral-300 pb-0.5 text-[11pt] font-bold text-neutral-900"
        >
          {renderPrintInline(
            trimmed.slice(3),
            itemMap,
            showAnswers,
            `h2-${i}`,
          )}
        </h2>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1
          key={`h1-${i}`}
          className="mt-2 mb-1 text-[12pt] font-bold text-neutral-950"
        >
          {renderPrintInline(
            trimmed.slice(2),
            itemMap,
            showAnswers,
            `h1-${i}`,
          )}
        </h1>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="my-1.5 border-l-2 border-neutral-400 pl-2.5 text-neutral-700 italic"
        >
          {renderPrintInline(
            trimmed.slice(2),
            itemMap,
            showAnswers,
            `quote-${i}`,
          )}
        </blockquote>,
      );
      i++;
      continue;
    }

    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`list-${i}`} className="my-1 list-disc space-y-0.5 pl-4">
          {listItems.map((entry, idx) => (
            <li key={`li-${i}-${idx}`}>
              {renderPrintInline(
                entry,
                itemMap,
                showAnswers,
                `li-${i}-${idx}`,
              )}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="my-1">
        {renderPrintInline(line, itemMap, showAnswers, `p-${i}`)}
      </p>,
    );
    i++;
  }

  return blocks;
}

export function A4PrintView({
  note,
  skillName,
}: {
  note: Pick<Note, "id" | "title" | "content_md" | "updated_at">;
  skillName: string | null;
}) {
  const [showAnswers, setShowAnswers] = useState(true);

  const parsed = useMemo(
    () => parseClozeMarkdown(note.content_md),
    [note.content_md],
  );

  const itemMap = useMemo(
    () => new Map(parsed.items.map((item) => [item.placeholder, item])),
    [parsed.items],
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <Link href={`/notes/${note.id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            <span>Kembali ke Editor</span>
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAnswers((prev) => !prev)}
          >
            {showAnswers ? (
              <>
                <EyeOff className="size-4" />
                <span>Sembunyikan Jawaban Cloze</span>
              </>
            ) : (
              <>
                <Eye className="size-4" />
                <span>Tampilkan Jawaban Cloze</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            <span>Cetak / Simpan PDF (A4)</span>
          </Button>
        </div>
      </div>

      <article className="a4-print-sheet mx-auto max-w-[210mm] rounded-xl border bg-white p-6 text-neutral-900 shadow-sm print:p-0">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-300 pb-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-950">
              {note.title}
            </h1>
            <p className="text-[11px] text-neutral-600">
              DevPrep Hub Cheat-Sheet • {parsed.clozeCount} poin cloze •{" "}
              {showAnswers ? "Kunci Jawaban" : "Lembar Latihan"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-600">
            {skillName ? (
              <Badge
                variant="outline"
                className="border-neutral-400 text-neutral-800"
              >
                {skillName}
              </Badge>
            ) : null}
            <span>
              {new Date(note.updated_at).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {note.content_md.trim() ? (
          <div className="a4-print-columns">
            {renderPrintBlocks(parsed.renderedPrompt, itemMap, showAnswers)}
          </div>
        ) : (
          <p className="text-sm text-neutral-500 italic">
            Catatan masih kosong.
          </p>
        )}
      </article>
    </div>
  );
}
