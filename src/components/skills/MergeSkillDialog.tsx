"use client";

import { GitMerge } from "lucide-react";
import { useState, useTransition } from "react";
import { mergeSkillsAction } from "@/actions/skills";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MergeableSkill = {
  id: string;
  name: string;
  slug: string;
  mastery_score: number;
};

export function MergeSkillDialog({ skills }: { skills: MergeableSkill[] }) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sourceSkill = skills.find((s) => s.id === sourceId);
  const targetSkill = skills.find((s) => s.id === targetId);
  const targetOptions = skills.filter((s) => s.id !== sourceId);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
      setSourceId("");
      setTargetId("");
    }
  }

  function handleSourceChange(value: string | null) {
    const next = value ?? "";
    setSourceId(next);
    if (next === targetId) {
      setTargetId("");
    }
    setError(null);
  }

  function handleSubmit() {
    if (!sourceId || !targetId) {
      setError("Pilih skill sumber dan skill target.");
      return;
    }

    startTransition(async () => {
      const result = await mergeSkillsAction({
        sourceSkillId: sourceId,
        targetSkillId: targetId,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      handleOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={skills.length < 2}
            className="gap-1.5"
          />
        }
      >
        <GitMerge className="size-4" />
        <span>Merge Skill</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gabungkan Skill Duplikat</DialogTitle>
          <DialogDescription>
            Seluruh catatan, kuis, modul track, dan riwayat interview dari skill
            sumber akan dipindahkan ke skill target secara atomik.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="merge-source-skill" className="text-xs font-medium">
              Skill Sumber (akan dihapus)
            </label>
            <Select value={sourceId} onValueChange={handleSourceChange}>
              <SelectTrigger id="merge-source-skill" className="w-full">
                <SelectValue>
                  {sourceSkill
                    ? `${sourceSkill.name} (${sourceSkill.mastery_score}%)`
                    : "Pilih skill sumber..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {skills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name} ({skill.slug}) — {skill.mastery_score}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="merge-target-skill" className="text-xs font-medium">
              Skill Target (dipertahankan)
            </label>
            <Select
              value={targetId}
              onValueChange={(value) => {
                setTargetId(value ?? "");
                setError(null);
              }}
            >
              <SelectTrigger id="merge-target-skill" className="w-full">
                <SelectValue>
                  {targetSkill
                    ? `${targetSkill.name} (${targetSkill.mastery_score}%)`
                    : "Pilih skill target..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name} ({skill.slug}) — {skill.mastery_score}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !sourceId || !targetId}
          >
            {isPending ? "Menggabungkan..." : "Gabungkan Skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
