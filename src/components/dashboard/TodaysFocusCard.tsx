import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  Rocket,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TodaysFocus } from "@/lib/todays-focus";

export function TodaysFocusCard({
  focus,
  counts,
}: {
  focus: TodaysFocus;
  counts: {
    dueInterviews: number;
    unreadDigests: number;
    activeModules: number;
  };
}) {
  const Icon =
    focus.kind === "interview"
      ? MessageSquare
      : focus.kind === "digest"
        ? BookOpen
        : focus.kind === "module"
          ? Rocket
          : Sparkles;

  return (
    <Card className="relative overflow-hidden border-border bg-card">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-foreground"
      />
      <CardHeader className="pb-3 pl-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Icon className="size-3.5 text-foreground" />
            <span>Today&apos;s Focus</span>
          </div>
          <Badge variant="mono" className="tabular-nums">
            {focus.badgeLabel}
          </Badge>
        </div>
        <CardTitle className="pt-1 text-lg tracking-[-0.02em]">
          {focus.title}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-sm text-muted-foreground">
          {focus.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-3 pl-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] tabular-nums">
            <strong className="font-semibold text-foreground">
              {counts.dueInterviews}
            </strong>
            <span>interview jatuh tempo</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] tabular-nums">
            <strong className="font-semibold text-foreground">
              {counts.unreadDigests}
            </strong>
            <span>digest belum dibaca</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] tabular-nums">
            <strong className="font-semibold text-foreground">
              {counts.activeModules}
            </strong>
            <span>modul aktif</span>
          </span>
        </div>

        <Link href={focus.href} className="group/cta">
          <Button size="sm" className="gap-1.5">
            <span>{focus.ctaLabel}</span>
            <ArrowRight className="size-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
