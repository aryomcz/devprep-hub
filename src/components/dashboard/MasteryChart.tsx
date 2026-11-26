import { Flame } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SkillStatus } from "@/types/database";

export type DashboardSkillBar = {
  id: string;
  name: string;
  masteryScore: number;
  status: SkillStatus;
};

export type DashboardQuizPoint = {
  id: string;
  score: number;
  label: string;
};

const BAR_COLOR: Record<SkillStatus, string> = {
  gap: "bg-destructive/75",
  learning: "bg-amber-500",
  mastered: "bg-emerald-600",
};

export function MasteryChart({
  skills,
  quizPoints,
  learningStreak,
  statusCounts,
}: {
  skills: DashboardSkillBar[];
  quizPoints: DashboardQuizPoint[];
  learningStreak: number;
  statusCounts: { gap: number; learning: number; mastered: number };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">
              Progres Mastery Score Skill
            </CardTitle>
            <CardDescription>
              Gabungan sinyal Quiz, Hands-On Lab, dan Interview Lab.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="default">{statusCounts.mastered} Mastered</Badge>
            <Badge variant="secondary">{statusCounts.learning} Learning</Badge>
            <Badge variant="outline">{statusCounts.gap} Gap</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-2.5">
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada skill tercatat. Sync GitHub atau analisis lowongan dari{" "}
              <Link href="/skills" className="underline">
                Master Skills
              </Link>
              .
            </p>
          ) : (
            skills.map((skill) => (
              <div key={skill.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{skill.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {skill.masteryScore}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${BAR_COLOR[skill.status]}`}
                    style={{ width: `${skill.masteryScore}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-5">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">
              Tren Quiz Attempt &amp; Streak
            </CardTitle>
            <CardDescription>
              8 percobaan kuis terbaru dan hari belajar aktif beruntun.
            </CardDescription>
          </div>

          <Badge variant="outline" className="gap-1">
            <Flame className="size-3.5 text-orange-500" />
            <span>{learningStreak} hari</span>
          </Badge>
        </CardHeader>

        <CardContent>
          {quizPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada riwayat kuis. Latih active recall di{" "}
              <Link href="/quiz" className="underline">
                Cloze Quiz
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-2">
              <svg
                viewBox="0 0 240 96"
                role="img"
                aria-label="Grafik tren skor kuis terbaru"
                className="h-28 w-full overflow-visible"
              >
                <line
                  x1="0"
                  y1="80"
                  x2="240"
                  y2="80"
                  className="stroke-border"
                  strokeWidth="1"
                />
                {quizPoints.map((point, idx) => {
                  const slotW = 240 / Math.max(quizPoints.length, 1);
                  const barW = Math.min(20, slotW * 0.6);
                  const barH = Math.max(4, (point.score / 100) * 70);
                  const x = idx * slotW + (slotW - barW) / 2;
                  const y = 80 - barH;
                  return (
                    <g key={point.id}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={barH}
                        rx="3"
                        className="fill-primary/80"
                      />
                      <text
                        x={x + barW / 2}
                        y={Math.max(10, y - 3)}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[8px] font-mono"
                      >
                        {point.score}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="flex flex-wrap justify-between gap-1 text-[10px] text-muted-foreground">
                {quizPoints.map((p) => (
                  <span key={p.id}>{p.label}</span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
