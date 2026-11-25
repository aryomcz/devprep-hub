"use client";

import { Info, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import {
  createSkillAction,
  deleteSkillAction,
  updateSkillAction,
} from "@/actions/skills";
import { MergeSkillDialog } from "@/components/skills/MergeSkillDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SkillCategory, SkillSource, SkillStatus } from "@/types/database";

export type SkillRow = {
  id: string;
  name: string;
  slug: string;
  category: SkillCategory;
  status: SkillStatus;
  mastery_score: number;
  source: SkillSource;
  updated_at: string;
  breakdown: {
    quiz: number | null;
    lab: number | null;
    interview: number | null;
  };
  capped: boolean;
  computedScore: number;
};

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: "Language",
  framework: "Framework",
  concept: "Concept",
  tool: "Tool",
};

const STATUS_LABELS: Record<SkillStatus, string> = {
  gap: "Gap",
  learning: "Learning",
  mastered: "Mastered",
};

const STATUS_VARIANTS: Record<
  SkillStatus,
  "destructive" | "secondary" | "default"
> = {
  gap: "destructive",
  learning: "secondary",
  mastered: "default",
};

function formatSignal(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

export function SkillTable({ skills }: { skills: SkillRow[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<SkillCategory>("concept");
  const [newScore, setNewScore] = useState("0");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit / override dialog state
  const [editingSkill, setEditingSkill] = useState<SkillRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<SkillCategory>("concept");
  const [editScore, setEditScore] = useState("0");
  const [editError, setEditError] = useState<string | null>(null);

  const filteredSkills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return skills.filter((skill) => {
      if (categoryFilter !== "all" && skill.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "all" && skill.status !== statusFilter) {
        return false;
      }
      if (
        query &&
        !skill.name.toLowerCase().includes(query) &&
        !skill.slug.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [skills, search, categoryFilter, statusFilter]);

  function openEditDialog(skill: SkillRow) {
    setEditingSkill(skill);
    setEditName(skill.name);
    setEditCategory(skill.category);
    setEditScore(String(skill.mastery_score));
    setEditError(null);
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    const parsedScore = Number.parseInt(newScore, 10);

    startTransition(async () => {
      const result = await createSkillAction({
        name: newName,
        category: newCategory,
        masteryScore: Number.isNaN(parsedScore) ? 0 : parsedScore,
      });

      if (!result.ok) {
        setCreateError(result.error);
        return;
      }

      setCreateOpen(false);
      setNewName("");
      setNewCategory("concept");
      setNewScore("0");
    });
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSkill) return;

    setEditError(null);
    const parsedScore = Number.parseInt(editScore, 10);
    if (Number.isNaN(parsedScore)) {
      setEditError("Mastery Score harus berupa angka 0–100.");
      return;
    }

    startTransition(async () => {
      const result = await updateSkillAction({
        id: editingSkill.id,
        name: editName,
        category: editCategory,
        masteryScore: parsedScore,
      });

      if (!result.ok) {
        setEditError(result.error);
        return;
      }

      setEditingSkill(null);
    });
  }

  function handleDelete(skill: SkillRow) {
    setActionError(null);
    startTransition(async () => {
      const result = await deleteSkillAction(skill.id);
      if (!result.ok) {
        setActionError(result.error);
      }
    });
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari skill atau slug..."
              className="w-full sm:w-64"
            />

            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value ?? "all")}
            >
              <SelectTrigger className="w-36">
                <SelectValue>
                  {categoryFilter === "all"
                    ? "Semua Kategori"
                    : CATEGORY_LABELS[categoryFilter as SkillCategory]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                <SelectItem value="language">Language</SelectItem>
                <SelectItem value="framework">Framework</SelectItem>
                <SelectItem value="concept">Concept</SelectItem>
                <SelectItem value="tool">Tool</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value ?? "all")}
            >
              <SelectTrigger className="w-36">
                <SelectValue>
                  {statusFilter === "all"
                    ? "Semua Status"
                    : STATUS_LABELS[statusFilter as SkillStatus]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="gap">Gap</SelectItem>
                <SelectItem value="learning">Learning</SelectItem>
                <SelectItem value="mastered">Mastered</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <MergeSkillDialog skills={skills} />

            <Dialog
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open);
                if (!open) setCreateError(null);
              }}
            >
              <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
                <Plus className="size-4" />
                <span>Tambah Skill</span>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Tambah Skill Baru</DialogTitle>
                  <DialogDescription>
                    Nama skill akan dinormalisasi otomatis untuk mencegah
                    duplikasi.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  {createError ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    >
                      {createError}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label htmlFor="new-skill-name" className="text-xs font-medium">
                      Nama Skill
                    </label>
                    <Input
                      id="new-skill-name"
                      required
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="Contoh: PostgreSQL, Next.js, C++"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Kategori</label>
                      <Select
                        value={newCategory}
                        onValueChange={(value) =>
                          setNewCategory((value as SkillCategory) ?? "concept")
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {CATEGORY_LABELS[newCategory]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="language">Language</SelectItem>
                          <SelectItem value="framework">Framework</SelectItem>
                          <SelectItem value="concept">Concept</SelectItem>
                          <SelectItem value="tool">Tool</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="new-skill-score" className="text-xs font-medium">
                        Mastery Score (0–100)
                      </label>
                      <Input
                        id="new-skill-score"
                        type="number"
                        min={0}
                        max={100}
                        value={newScore}
                        onChange={(event) => setNewScore(event.target.value)}
                      />
                    </div>
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
                      {isPending ? "Menyimpan..." : "Simpan Skill"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {actionError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {actionError}
          </div>
        ) : null}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Skill</th>
                    <th className="px-4 py-3 font-medium">Kategori</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Mastery Score</th>
                    <th className="px-4 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSkills.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        {skills.length === 0
                          ? "Belum ada skill. Tambahkan skill manual atau lanjutkan ke Sync GitHub / JD Analyzer."
                          : "Tidak ada skill yang cocok dengan filter saat ini."}
                      </td>
                    </tr>
                  ) : (
                    filteredSkills.map((skill) => {
                      const isOverridden =
                        skill.mastery_score !== skill.computedScore;
                      return (
                        <tr key={skill.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{skill.name}</span>
                              <Badge variant="outline" className="text-[11px]">
                                {skill.slug}
                              </Badge>
                              <Badge variant="ghost" className="text-[11px]">
                                {skill.source}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {CATEGORY_LABELS[skill.category]}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANTS[skill.status]}>
                              {STATUS_LABELS[skill.status]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-44 items-center gap-2">
                              <Progress
                                value={skill.mastery_score}
                                className="w-24"
                              />
                              <span className="w-10 text-xs font-medium tabular-nums">
                                {skill.mastery_score}%
                              </span>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      aria-label={`Rincian mastery ${skill.name}`}
                                    />
                                  }
                                >
                                  <Info className="size-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="flex-col items-start gap-1 text-left">
                                  <div className="font-medium">
                                    Rincian Sinyal (Q/L/I)
                                  </div>
                                  <div>
                                    Quiz: {formatSignal(skill.breakdown.quiz)} ·
                                    Lab: {formatSignal(skill.breakdown.lab)} ·
                                    Interview:{" "}
                                    {formatSignal(skill.breakdown.interview)}
                                  </div>
                                  {skill.capped ? (
                                    <div>
                                      Tertahan di cap 65% (baru 1 sinyal aktif)
                                    </div>
                                  ) : null}
                                  {isOverridden ? (
                                    <div>
                                      Manual override aktif (kalkulasi:{" "}
                                      {skill.computedScore}%)
                                    </div>
                                  ) : null}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${skill.name}`}
                                onClick={() => openEditDialog(skill)}
                                disabled={isPending}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Hapus ${skill.name}`}
                                onClick={() => handleDelete(skill)}
                                disabled={isPending}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={editingSkill !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingSkill(null);
              setEditError(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit &amp; Override Skill</DialogTitle>
              <DialogDescription>
                Ubah nama, kategori, atau setel skor manual (0–100); status
                otomatis menyesuaikan skor.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {editError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {editError}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="edit-skill-name" className="text-xs font-medium">
                  Nama Skill
                </label>
                <Input
                  id="edit-skill-name"
                  required
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Kategori</label>
                  <Select
                    value={editCategory}
                    onValueChange={(value) =>
                      setEditCategory((value as SkillCategory) ?? "concept")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{CATEGORY_LABELS[editCategory]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="language">Language</SelectItem>
                      <SelectItem value="framework">Framework</SelectItem>
                      <SelectItem value="concept">Concept</SelectItem>
                      <SelectItem value="tool">Tool</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-skill-score" className="text-xs font-medium">
                    Mastery Score (0–100)
                  </label>
                  <Input
                    id="edit-skill-score"
                    type="number"
                    min={0}
                    max={100}
                    value={editScore}
                    onChange={(event) => setEditScore(event.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingSkill(null)}
                  disabled={isPending}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
