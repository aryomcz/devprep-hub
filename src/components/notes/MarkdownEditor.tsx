"use client";

import {
  ArrowLeft,
  BookOpen,
  Code2,
  FileText,
  HelpCircle,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  createNoteAction,
  deleteNoteAction,
  updateNoteAction,
} from "@/actions/notes";
import { QuickLookupDrawer } from "@/components/notes/QuickLookupDrawer";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { parseClozeMarkdown, type ClozeItem } from "@/lib/cloze-parser";

export type NoteSkillOption = {
  id: string;
  name: string;
  slug: string;
};

export type NoteSummary = {
  id: string;
  title: string;
  content_md: string;
  skill_id: string | null;
  updated_at: string;
  clozeCount: number;
};

function renderInlineWithCloze(
  text: string,
  itemMap: Map<string, ClozeItem>,
  keyPrefix: string,
): ReactNode[] {
  const parts = text.split(/(___CLOZE_\d+___|``[^`]+``|`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.filter(Boolean).map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith("___CLOZE_") && part.endsWith("___")) {
      const item = itemMap.get(part);
      if (item) {
        return (
          <span
            key={key}
            className="mx-0.5 inline-flex items-center gap-1 rounded border border-[color-mix(in_oklab,var(--ring)_38%,transparent)] bg-[color-mix(in_oklab,var(--ring)_13%,transparent)] px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums text-foreground"
          >
            <span className="text-[var(--ring)]">#{item.index}:</span>
            <span>{item.answer}</span>
            {item.hint ? (
              <span className="text-[11px] text-muted-foreground">
                ({item.hint})
              </span>
            ) : null}
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
          {renderInlineWithCloze(inner, itemMap, `${key}-code`)}
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

function renderMarkdownPreview(
  renderedPrompt: string,
  itemMap: Map<string, ClozeItem>,
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
        <div key={`code-${i}`} className="space-y-1">
          {lang ? (
            <div className="text-[11px] font-medium uppercase text-muted-foreground">
              {lang}
            </div>
          ) : null}
          <pre className="overflow-x-auto rounded-lg border bg-muted/60 p-3 font-mono text-xs leading-relaxed">
            <code>
              {renderInlineWithCloze(
                codeLines.join("\n"),
                itemMap,
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

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${i}`} className="pt-2 text-base font-semibold">
          {renderInlineWithCloze(trimmed.slice(4), itemMap, `h3-${i}`)}
        </h3>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${i}`} className="pt-2 text-lg font-semibold">
          {renderInlineWithCloze(trimmed.slice(3), itemMap, `h2-${i}`)}
        </h2>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${i}`} className="pt-1 text-xl font-bold">
          {renderInlineWithCloze(trimmed.slice(2), itemMap, `h1-${i}`)}
        </h1>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic"
        >
          {renderInlineWithCloze(trimmed.slice(2), itemMap, `quote-${i}`)}
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
        <ul key={`list-${i}`} className="list-disc space-y-1 pl-5 text-sm">
          {listItems.map((entry, idx) => (
            <li key={`li-${i}-${idx}`}>
              {renderInlineWithCloze(entry, itemMap, `li-${i}-${idx}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed">
        {renderInlineWithCloze(line, itemMap, `p-${i}`)}
      </p>,
    );
    i++;
  }

  return blocks;
}

export function NotesDirectory({
  notes,
  skills,
}: {
  notes: NoteSummary[];
  skills: NoteSkillOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSkillId, setNewSkillId] = useState("none");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const skillNameMap = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill.name])),
    [skills],
  );

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes.filter((note) => {
      if (skillFilter === "unassigned" && note.skill_id !== null) {
        return false;
      }
      if (
        skillFilter !== "all" &&
        skillFilter !== "unassigned" &&
        note.skill_id !== skillFilter
      ) {
        return false;
      }
      if (
        query &&
        !note.title.toLowerCase().includes(query) &&
        !note.content_md.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [notes, search, skillFilter]);

  const groupedNotes = useMemo(() => {
    const groups = new Map<string, { label: string; items: NoteSummary[] }>();
    for (const note of filteredNotes) {
      const key = note.skill_id ?? "unassigned";
      const label = note.skill_id
        ? (skillNameMap.get(note.skill_id) ?? "Skill Terkait")
        : "Umum (Tanpa Skill)";
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(note);
      } else {
        groups.set(key, { label, items: [note] });
      }
    }
    return Array.from(groups.entries());
  }, [filteredNotes, skillNameMap]);

  function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    startTransition(async () => {
      const result = await createNoteAction({
        title: newTitle,
        skillId: newSkillId === "none" ? null : newSkillId,
      });

      if (!result.ok) {
        setCreateError(result.error);
        return;
      }

      setCreateOpen(false);
      setNewTitle("");
      setNewSkillId("none");
      router.push(`/notes/${result.data.noteId}`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari judul atau isi catatan..."
            className="w-full sm:w-72"
          />

          <Select
            value={skillFilter}
            onValueChange={(value) => setSkillFilter(value ?? "all")}
          >
            <SelectTrigger className="w-48">
              <SelectValue>
                {skillFilter === "all"
                  ? "Semua Skill"
                  : skillFilter === "unassigned"
                    ? "Tanpa Skill"
                    : (skillNameMap.get(skillFilter) ?? "Skill")}
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
            <span>Catatan Baru</span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Buat Catatan &amp; Cheat-Sheet</DialogTitle>
              <DialogDescription>
                Tautkan catatan ke Master Skill dan tandai poin penting dengan{" "}
                {"{{kata_kunci}}"} untuk kuis active recall.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateNote} className="space-y-4">
              {createError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {createError}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="note-title" className="text-xs font-medium">
                  Judul Catatan
                </label>
                <Input
                  id="note-title"
                  required
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Contoh: Indexing & MVCC di PostgreSQL"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  Skill Terkait (Opsional)
                </label>
                <Select
                  value={newSkillId}
                  onValueChange={(value) => setNewSkillId(value ?? "none")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {newSkillId === "none"
                        ? "Tanpa Skill"
                        : (skillNameMap.get(newSkillId) ?? "Pilih Skill")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Skill</SelectItem>
                    {skills.map((skill) => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Membuat..." : "Buat & Buka Editor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groupedNotes.length === 0 ? (
        <Card className="border-dashed bg-card/60">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <BookOpen className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {notes.length === 0
                ? "Belum ada catatan. Buat catatan pertama untuk mulai mengumpulkan bahan active recall."
                : "Tidak ada catatan yang cocok dengan filter pencarian."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedNotes.map(([groupKey, group]) => (
            <section key={groupKey} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{group.label}</h2>
                <Badge variant="mono" className="tabular-nums">
                  {group.items.length}
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.items.map((note) => (
                  <Card
                    key={note.id}
                    className="flex flex-col justify-between hover:border-foreground/20"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2 text-base">
                          {note.title}
                        </CardTitle>
                        <Badge variant="mono" className="shrink-0 tabular-nums">
                          {note.clozeCount} Cloze
                        </Badge>
                      </div>
                      <CardDescription className="font-mono text-xs tabular-nums">
                        Diperbarui {note.updated_at.slice(0, 10)}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <p className="line-clamp-3 text-xs text-muted-foreground">
                        {note.content_md.trim() || "Catatan masih kosong."}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Link href={`/notes/${note.id}`}>
                          <Button size="xs" variant="default" className="gap-1">
                            <FileText className="size-3" />
                            <span>Edit</span>
                          </Button>
                        </Link>
                        <Link href={`/quiz?noteId=${note.id}`}>
                          <Button size="xs" variant="outline" className="gap-1">
                            <HelpCircle className="size-3" />
                            <span>Kuis</span>
                          </Button>
                        </Link>
                        <Link href={`/notes/${note.id}/print`}>
                          <Button size="xs" variant="ghost" className="gap-1">
                            <Printer className="size-3" />
                            <span>A4</span>
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarkdownEditor({
  note,
  skills,
}: {
  note: {
    id: string;
    title: string;
    content_md: string;
    skill_id: string | null;
    updated_at: string;
  };
  skills: NoteSkillOption[];
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(note.title);
  const [contentMd, setContentMd] = useState(note.content_md);
  const [skillId, setSkillId] = useState<string>(note.skill_id ?? "none");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const skillNameMap = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill.name])),
    [skills],
  );

  const parsedCloze = useMemo(
    () => parseClozeMarkdown(contentMd),
    [contentMd],
  );

  const itemMap = useMemo(
    () => new Map(parsedCloze.items.map((item) => [item.placeholder, item])),
    [parsedCloze.items],
  );

  function wrapSelection(mode: "prose" | "code") {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? contentMd.length;
    const end = el.selectionEnd ?? contentMd.length;
    const selected = contentMd.slice(start, end).trim();

    const wrapped =
      mode === "prose"
        ? `{{${selected || "kata_kunci"}}}`
        : `{{cloze:${selected || "kode"}}}`;

    const nextText =
      contentMd.slice(0, start) + wrapped + contentMd.slice(end);
    setContentMd(nextText);
    setStatusMessage(null);

    const cursorPos = start + wrapped.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function handleInsertLookupSnippet(snippet: string) {
    setContentMd((prev) =>
      prev.trim() ? `${prev.trimEnd()}\n\n${snippet}` : snippet,
    );
    setStatusMessage("Referensi disisipkan ke editor (jangan lupa Simpan).");
  }

  function handleSave() {
    setErrorMessage(null);
    setStatusMessage(null);

    startTransition(async () => {
      const result = await updateNoteAction({
        id: note.id,
        title,
        contentMd,
        skillId: skillId === "none" ? null : skillId,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setStatusMessage("Catatan tersimpan.");
      router.refresh();
    });
  }

  function handleDelete() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteNoteAction(note.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        setDeleteOpen(false);
        return;
      }

      router.push("/notes");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/notes">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            <span>Kembali ke Catatan</span>
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="mono" className="tabular-nums">
            {parsedCloze.clozeCount} Soal Cloze
          </Badge>

          <QuickLookupDrawer onInsertSnippet={handleInsertLookupSnippet} />

          <Link href={`/quiz?noteId=${note.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <HelpCircle className="size-4" />
              <span>Mulai Kuis Cloze</span>
            </Button>
          </Link>

          <Link href={`/notes/${note.id}/print`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Printer className="size-4" />
              <span>Export A4</span>
            </Button>
          </Link>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger
              render={
                <Button variant="destructive" size="sm" className="gap-1.5" />
              }
            >
              <Trash2 className="size-4" />
              <span>Hapus</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Hapus Catatan?</DialogTitle>
                <DialogDescription>
                  Catatan &ldquo;{title}&rdquo; akan dihapus permanen.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteOpen(false)}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? "Menghapus..." : "Ya, Hapus"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending || !title.trim()}
            className="gap-1.5"
          >
            <Save className="size-4" />
            <span>{isPending ? "Menyimpan..." : "Simpan"}</span>
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-foreground">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setStatusMessage(null);
          }}
          placeholder="Judul catatan..."
          aria-label="Judul catatan"
        />

        <Select
          value={skillId}
          onValueChange={(value) => {
            setSkillId(value ?? "none");
            setStatusMessage(null);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {skillId === "none"
                ? "Tanpa Skill"
                : (skillNameMap.get(skillId) ?? "Pilih Skill")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Tanpa Skill</SelectItem>
            {skills.map((skill) => (
              <SelectItem key={skill.id} value={skill.id}>
                {skill.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">Editor Markdown</CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => wrapSelection("prose")}
                  className="gap-1"
                >
                  <Sparkles className="size-3" />
                  <span>Jadikan Cloze {"{{...}}"}</span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => wrapSelection("code")}
                  className="gap-1"
                >
                  <Code2 className="size-3" />
                  <span>Cloze Kode {"{{cloze:...}}"}</span>
                </Button>
              </div>
            </div>
            <CardDescription className="text-xs">
              Blok kode mengabaikan {"{{...}}"} secara default; gunakan{" "}
              <code>{"{{cloze:jawaban}}"}</code> untuk isian kode.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3">
            <Textarea
              ref={textareaRef}
              value={contentMd}
              onChange={(event) => {
                setContentMd(event.target.value);
                setStatusMessage(null);
              }}
              placeholder="Tulis ringkasan teknis dalam Markdown..."
              className="min-h-[420px] font-mono text-sm leading-relaxed"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Live Preview</CardTitle>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {parsedCloze.clozeCount} cloze terdeteksi
              </span>
            </div>
            <CardDescription className="text-xs">
              Pratinjau deterministik dari <code>parseClozeMarkdown</code>.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="min-h-[420px] space-y-3 pt-3">
            {contentMd.trim() ? (
              renderMarkdownPreview(parsedCloze.renderedPrompt, itemMap)
            ) : (
              <p className="text-sm text-muted-foreground">
                Pratinjau akan tampil saat kamu mulai mengetik.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
