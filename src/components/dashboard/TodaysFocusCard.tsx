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
import type { TodaysFocusResult } from "@/lib/todays-focus";

export function TodaysFocusCard({
  focus,
  counts,
}: {
  focus: TodaysFocusResult;
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
    <Card className="border-primary/30 bg-gradient-to-br from-card to-muted/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Icon className="size-4" />
            <span>Today&apos;s Focus</span>
          </div>
          <Badge variant="default">{focus.badgeLabel}</Badge>
        </div>
        <CardTitle className="pt-1 text-lg">{focus.title}</CardTitle>
        <CardDescription className="line-clamp-2 text-sm text-foreground/80">
          {focus.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{counts.dueInterviews} interview jatuh tempo</span>
          <span>•</span>
          <span>{counts.unreadDigests} digest belum dibaca</span>
          <span>•</span>
          <span>{counts.activeModules} modul aktif</span>
        </div>

        <Link href={focus.href}>
          <Button size="sm" className="gap-1.5">
            <span>{focus.ctaLabel}</span>
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
