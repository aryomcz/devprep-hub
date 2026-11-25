import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan kesiapan magang, fokus harian, dan progres penguasaan skill."
        actions={
          <Link href="/skills">
            <Button size="sm" variant="outline">
              Kelola Master Skills
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Today&apos;s Focus</CardTitle>
              <Badge variant="secondary">Step 5.3</Badge>
            </div>
            <CardDescription>
              Prioritas harian deterministik dari antrean review, digest, dan modul aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Shell dashboard aktif dan terproteksi Single-User Gate.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Readiness Meter</CardTitle>
              <Badge variant="outline">Bobot 2:1</Badge>
            </div>
            <CardDescription>
              Kesiapan tiap Target Internship berdasarkan bobot must_have dan nice_to_have.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Akan terhubung setelah modul Master Skills &amp; JD Analyzer aktif.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mastery Overview</CardTitle>
              <Badge variant="outline">0–100</Badge>
            </div>
            <CardDescription>
              Gabungan sinyal Quiz, Hands-On Lab, dan Interview Lab.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Siap dimulai dari direktori Master Skills pada Step 1.3.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
