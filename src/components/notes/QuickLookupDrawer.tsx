"use client";

import { BookSearch, ExternalLink, Plus, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ResourceSource } from "@/types/database";

type LookupResultItem = {
  source: ResourceSource;
  title: string;
  url: string;
  summary: string;
};

const SOURCE_LABELS: Record<ResourceSource, string> = {
  wikipedia: "Wikipedia",
  mdn: "MDN",
  stackoverflow: "Stack Overflow",
  devto: "Dev.to",
  youtube: "YouTube",
  github: "GitHub",
};

function toSafeExternalUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : "#";
  } catch {
    return "#";
  }
}

export function QuickLookupDrawer({
  onInsertSnippet,
}: {
  onInsertSnippet: (snippet: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LookupResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/resources/lookup?q=${encodeURIComponent(trimmed)}`,
      );
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        results?: LookupResultItem[];
      };

      if (!res.ok) {
        setError(payload.error ?? "Gagal mencari referensi.");
        setResults([]);
        return;
      }

      setResults(payload.results ?? []);
    } catch {
      setError("Gagal menghubungi server Quick Lookup.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleInsert(item: LookupResultItem) {
    const safeUrl = toSafeExternalUrl(item.url);
    const snippet = [
      `### {{${item.title}}}`,
      "",
      item.summary || "Ringkasan konsep.",
      "",
      safeUrl !== "#"
        ? `> Referensi (${SOURCE_LABELS[item.source]}): [${item.title}](${safeUrl})`
        : `> Referensi (${SOURCE_LABELS[item.source]}): ${item.title}`,
    ].join("\n");

    onInsertSnippet(snippet);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" />
        }
      >
        <BookSearch className="size-4" />
        <span>Quick Lookup</span>
      </SheetTrigger>

      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Quick Lookup Referensi</SheetTitle>
          <SheetDescription>
            Cari definisi dan diskusi cepat dari Wikipedia, MDN, dan Stack
            Overflow lalu sisipkan ke catatan.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Contoh: idempotency, flexbox, mvcc..."
              required
              disabled={loading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !query.trim()}
              className="gap-1.5"
            >
              <Search className="size-4" />
              <span>{loading ? "Mencari..." : "Cari"}</span>
            </Button>
          </form>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          ) : null}

          {hasSearched && !loading && !error && results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ditemukan referensi untuk kata kunci tersebut.
            </p>
          ) : null}

          <div className="space-y-3">
            {results.map((item) => (
              <Card key={item.url} size="sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">
                      {SOURCE_LABELS[item.source]}
                    </Badge>
                    <a
                      href={toSafeExternalUrl(item.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span>Buka</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                  {item.summary ? (
                    <CardDescription className="line-clamp-3 text-xs">
                      {item.summary}
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => handleInsert(item)}
                    className="gap-1"
                  >
                    <Plus className="size-3" />
                    <span>Sisipkan ke Catatan</span>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
