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

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-2">
          <div>
            <Badge variant="mono">404</Badge>
          </div>
          <CardTitle className="text-lg">Halaman tidak ditemukan</CardTitle>
          <CardDescription>
            Tautan atau entitas yang Anda cari tidak tersedia atau tidak lagi
            memiliki akses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard">
            <Button type="button">Kembali ke Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
