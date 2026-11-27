"use client";

import { ArrowRight, Building2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteInternshipAction,
  updateInternshipStatusAction,
} from "@/actions/internships";
import { JDAnalyzerForm } from "@/components/internships/JDAnalyzerForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateReadinessMeter } from "@/lib/mastery";
import type { InternshipStatus, SkillPriority } from "@/types/database";

export type InternshipSkillReadiness = {
  skillId: string;
  name: string;
  priority: SkillPriority;
  masteryScore: number;
};

export type InternshipSummaryItem = {
  id: string;
  title: string;
  company_name: string;
  industry: string;
  status: InternshipStatus;
  created_at: string;
  skills: InternshipSkillReadiness[];
};

export const INTERNSHIP_STATUS_LABELS: Record<InternshipStatus, string> = {
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

const STATUS_OPTIONS: InternshipStatus[] = [
  "preparing",
  "applied",
  "interview",
  "offer",
  "rejected",
];

function StatusControls({
  internshipId,
  status,
  redirectAfterDelete = false,
}: {
  internshipId: string;
  status: InternshipStatus;
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<InternshipStatus>(status);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(nextValue: string | null) {
    if (!nextValue || !STATUS_OPTIONS.includes(nextValue as InternshipStatus)) {
      return;
    }
    const nextStatus = nextValue as InternshipStatus;
    const previous = currentStatus;
    setCurrentStatus(nextStatus);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await updateInternshipStatusAction({
        id: internshipId,
        status: nextStatus,
      });
      if (!result.ok) {
        setCurrentStatus(previous);
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteInternshipAction(internshipId);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      if (redirectAfterDelete) {
        router.push("/internships");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Select
          value={currentStatus}
          onValueChange={handleStatusChange}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue>{INTERNSHIP_STATUS_LABELS[currentStatus]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {INTERNSHIP_STATUS_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isPending}
          aria-label="Hapus target magang"
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {errorMessage ? (
        <p className="text-[11px] text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

export function ReadinessCard({
  internship,
}: {
  internship: InternshipSummaryItem;
}) {
  const readinessScore = useMemo(
    () =>
      calculateReadinessMeter(
        internship.skills.map((skill) => ({
          masteryScore: skill.masteryScore,
          priority: skill.priority,
        })),
      ),
    [internship.skills],
  );

  const mustHaveCount = internship.skills.filter(
    (skill) => skill.priority === "must_have",
  ).length;
  const niceToHaveCount = internship.skills.length - mustHaveCount;
  const gapCount = internship.skills.filter(
    (skill) => skill.masteryScore < 30,
  ).length;

  const readinessVariant =
    readinessScore >= 80
      ? "mastered"
      : readinessScore >= 30
        ? "learning"
        : "gap";

  return (
    <Card className="flex flex-col justify-between hover:border-foreground/20">
      <CardHeader className="space-y-2.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/internships/${internship.id}`}
              className="hover:underline underline-offset-4"
            >
              <CardTitle className="truncate text-base">
                {internship.title}
              </CardTitle>
            </Link>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <Building2 className="size-3.5 shrink-0" />
              <span>{internship.company_name || "Perusahaan Umum"}</span>
              {internship.industry ? (
                <Badge variant="mono" className="text-[10px]">
                  {internship.industry}
                </Badge>
              ) : null}
            </CardDescription>
          </div>
          <Badge variant={readinessVariant} className="font-mono tabular-nums">
            {readinessScore}% Siap
          </Badge>
        </div>

        <Progress value={readinessScore} className="w-full" />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="secondary" className="font-mono tabular-nums">
            {mustHaveCount} Must-Have
          </Badge>
          <Badge variant="outline" className="font-mono tabular-nums">
            {niceToHaveCount} Nice-to-Have
          </Badge>
          <Badge
            variant={gapCount > 0 ? "gap" : "outline"}
            className="font-mono tabular-nums"
          >
            {gapCount} Gap
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 pt-3">
          <StatusControls
            internshipId={internship.id}
            status={internship.status}
          />

          <Link href={`/internships/${internship.id}`} className="group/detail">
            <Button variant="outline" size="xs" className="gap-1">
              <span>Detail</span>
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover/detail:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function InternshipDetailActions({
  internshipId,
  status,
}: {
  internshipId: string;
  status: InternshipStatus;
}) {
  return (
    <StatusControls
      internshipId={internshipId}
      status={status}
      redirectAfterDelete
    />
  );
}

export function InternshipsDirectory({
  internships,
}: {
  internships: InternshipSummaryItem[];
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return internships;
    return internships.filter((item) => item.status === statusFilter);
  }, [internships, statusFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value ?? "all")}
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              {statusFilter === "all"
                ? "Semua Status Lamaran"
                : INTERNSHIP_STATUS_LABELS[statusFilter as InternshipStatus]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status Lamaran</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {INTERNSHIP_STATUS_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <JDAnalyzerForm />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed bg-card/60">
          <CardHeader className="py-8 text-center">
            <CardTitle className="text-base">
              {internships.length === 0
                ? "Belum Ada Target Magang"
                : "Tidak Ada Lowongan untuk Filter Ini"}
            </CardTitle>
            <CardDescription className="mx-auto max-w-md">
              {internships.length === 0
                ? "Klik Analisis Lowongan Baru untuk memetakan skill gap, glosarium istilah, dan Readiness Meter Anda."
                : "Ubah filter status lamaran untuk melihat target lainnya."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((internship) => (
            <ReadinessCard key={internship.id} internship={internship} />
          ))}
        </div>
      )}
    </div>
  );
}
