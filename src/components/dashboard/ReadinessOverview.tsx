import { ArrowRight, Building2, Rocket } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";

export type DashboardInternshipReadiness = {
  id: string;
  title: string;
  companyName: string;
  readinessScore: number;
};

export type DashboardActiveTrack = {
  id: string;
  capstoneTitle: string;
  primaryStack: string;
  completedModules: number;
  totalModules: number;
};

export function ReadinessOverview({
  internships,
  activeTracks,
}: {
  internships: DashboardInternshipReadiness[];
  activeTracks: DashboardActiveTrack[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">
              Readiness Meter Target Magang
            </CardTitle>
            <CardDescription>
              Bobot 2:1 antara skill Must-Have vs Nice-to-Have.
            </CardDescription>
          </div>
          <Link href="/internships">
            <Button variant="ghost" size="xs" className="gap-1">
              <span>Semua</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="space-y-3">
          {internships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada Target Magang. Tambahkan lowongan di{" "}
              <Link href="/internships" className="underline">
                Target Magang
              </Link>
              .
            </p>
          ) : (
            internships.map((item) => (
              <Link
                key={item.id}
                href={`/internships/${item.id}`}
                className="block space-y-1.5 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="size-3" />
                      <span>{item.companyName || "Perusahaan Umum"}</span>
                    </div>
                  </div>
                  <Badge
                    variant={item.readinessScore >= 70 ? "default" : "secondary"}
                  >
                    {item.readinessScore}%
                  </Badge>
                </div>
                <Progress value={item.readinessScore} className="w-full" />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Rocket className="size-4" />
              <span>Progres One-App Capstone</span>
            </CardTitle>
            <CardDescription>
              Learning Track aktif dan penyelesaian Track Module.
            </CardDescription>
          </div>
          <Link href="/tracks">
            <Button variant="ghost" size="xs" className="gap-1">
              <span>Semua</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="space-y-3">
          {activeTracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada Learning Track aktif. Buat blueprint di{" "}
              <Link href="/tracks" className="underline">
                Learning Tracks
              </Link>
              .
            </p>
          ) : (
            activeTracks.map((track) => {
              const pct =
                track.totalModules > 0
                  ? Math.round(
                      (track.completedModules / track.totalModules) * 100,
                    )
                  : 0;
              return (
                <Link
                  key={track.id}
                  href={`/tracks/${track.id}`}
                  className="block space-y-1.5 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {track.capstoneTitle}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {track.primaryStack} • {track.completedModules}/
                        {track.totalModules} modul selesai
                      </div>
                    </div>
                    <Badge variant="outline">{pct}%</Badge>
                  </div>
                  <Progress value={pct} className="w-full" />
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
