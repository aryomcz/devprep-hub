"use client";

import { CheckSquare, Code2, Layers, Lightbulb, Lock, Unlock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { HandsOnTicket } from "@/types/schemas";

export function ProgressiveHints({
  ticket,
  capstoneTitle,
  targetLanguage,
}: {
  ticket: HandsOnTicket;
  capstoneTitle: string;
  targetLanguage: string;
}) {
  const [unlockedLevel, setUnlockedLevel] = useState<0 | 1 | 2 | 3>(0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Hands-On Ticket</CardTitle>
              <CardDescription>
                Implementasikan di IDE lokal Anda pada proyek{" "}
                <span className="font-medium text-foreground">
                  {capstoneTitle}
                </span>
                .
              </CardDescription>
            </div>
            <Badge variant="outline">{targetLanguage}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{ticket.problem_context}</p>

          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CheckSquare className="size-3.5" />
              <span>Acceptance Criteria ({ticket.acceptance_criteria.length})</span>
            </h3>
            <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
              {ticket.acceptance_criteria.map((criterion, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono font-semibold text-primary">
                    {idx + 1}.
                  </span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="size-4 text-amber-500" />
            <span>Progressive Hints (3 Tingkat)</span>
          </CardTitle>
          <CardDescription>
            Buka bantuan secara bertahap bila Anda menemui kebuntuan: Arsitektur
            → Pseudocode → Contoh Implementasi.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Level 1: Architecture */}
          <div className="rounded-lg border p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Layers className="size-4 text-primary" />
                <span>Level 1: Panduan Arsitektur</span>
              </div>
              {unlockedLevel >= 1 ? (
                <Badge variant="secondary">Terbuka</Badge>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setUnlockedLevel(1)}
                  className="gap-1.5"
                >
                  <Unlock className="size-3.5" />
                  <span>Buka Level 1</span>
                </Button>
              )}
            </div>
            {unlockedLevel >= 1 ? (
              <p className="mt-2.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {ticket.progressive_hints.architecture}
              </p>
            ) : null}
          </div>

          {/* Level 2: Pseudocode */}
          <div className="rounded-lg border p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Code2 className="size-4 text-primary" />
                <span>Level 2: Pseudocode</span>
              </div>
              {unlockedLevel >= 2 ? (
                <Badge variant="secondary">Terbuka</Badge>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={unlockedLevel < 1}
                  onClick={() => setUnlockedLevel(2)}
                  className="gap-1.5"
                >
                  {unlockedLevel < 1 ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <Unlock className="size-3.5" />
                  )}
                  <span>Buka Level 2</span>
                </Button>
              )}
            </div>
            {unlockedLevel >= 2 ? (
              <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap rounded border bg-muted/50 p-2.5 font-mono text-xs leading-relaxed">
                {ticket.progressive_hints.pseudocode}
              </pre>
            ) : null}
          </div>

          {/* Level 3: Implementation */}
          <div className="rounded-lg border p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Code2 className="size-4 text-primary" />
                <span>Level 3: Contoh Implementasi</span>
              </div>
              {unlockedLevel >= 3 ? (
                <Badge variant="secondary">Terbuka</Badge>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={unlockedLevel < 2}
                  onClick={() => setUnlockedLevel(3)}
                  className="gap-1.5"
                >
                  {unlockedLevel < 2 ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <Unlock className="size-3.5" />
                  )}
                  <span>Buka Level 3</span>
                </Button>
              )}
            </div>
            {unlockedLevel >= 3 ? (
              <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap rounded border bg-muted/50 p-2.5 font-mono text-xs leading-relaxed">
                <code>{ticket.progressive_hints.implementation}</code>
              </pre>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
