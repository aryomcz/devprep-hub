"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
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

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="gap" className="gap-1">
              <AlertTriangle className="size-3" />
              Gangguan Memuat Halaman
            </Badge>
            {error.digest ? (
              <Badge variant="mono" className="text-[11px]">
                {error.digest}
              </Badge>
            ) : null}
          </div>
          <CardTitle className="text-lg">
            Terjadi kesalahan saat mengambil data
          </CardTitle>
          <CardDescription>
            Koneksi ke server atau database sedang terganggu. Anda dapat mencoba
            memuat ulang atau kembali ke Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={reset} className="gap-1.5">
            <RotateCcw className="size-4" />
            <span>Coba Muat Ulang</span>
          </Button>
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Kembali ke Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
