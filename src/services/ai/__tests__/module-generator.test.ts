import { describe, expect, it, vi } from "vitest";
import { GeminiRateLimitError } from "@/lib/gemini";
import {
  generateModuleContent,
  type GenerateModuleContentFn,
  type ModuleGenerationContext,
} from "@/services/ai/module-generator";

const BASE_CONTEXT: ModuleGenerationContext = {
  capstoneTitle: "OrderLedger Hub",
  capstoneDescription: "Platform pemrosesan transaksi dan analitik pesanan.",
  primaryStack: "TypeScript + PostgreSQL",
  architectureOverview: "Next.js API + PostgreSQL relasional.",
  skillName: "PostgreSQL",
  skillCategory: "tool",
  moduleType: "capstone_feature",
  targetLanguage: "SQL",
  objective: "Rancang skema ledger dengan constraint dan index.",
  curatedResources: [
    {
      source: "devto",
      title: "PostgreSQL Indexing Guide",
      url: "https://dev.to/alice/pg-indexing",
      summary: "B-Tree vs GIN.",
    },
  ],
};

describe("generateModuleContent", () => {
  it("validates concept_brief, warmup_drills placeholders, and 3-level progressive_hints while injecting context into prompt", async () => {
    let seenPrompt = "";
    const mockAi = vi.fn<GenerateModuleContentFn>(async (prompt) => {
      seenPrompt = prompt;
      return {
        concept_brief: {
          summary: "PostgreSQL menjaga integritas data lewat ACID & constraint.",
          analogy: "Seperti buku besar akuntansi dengan aturan validasi ketat.",
          key_points: ["Gunakan FOREIGN KEY", "Tambahkan B-Tree index"],
        },
        warmup_drills: [
          {
            title: "Buat Index Transaksi",
            language: "sql",
            code_template:
              "CREATE ___BLANK_1___ idx_orders_user ON orders (___BLANK_2___);",
            blanks: [
              { id: "BLANK_1", answer: "INDEX", hint: "Kata kunci index SQL" },
              { id: "BLANK_2", answer: "user_id" },
            ],
          },
        ],
        hands_on_ticket: {
          problem_context: "Tambahkan tabel ledger untuk OrderLedger Hub.",
          acceptance_criteria: [
            "Memiliki primary key UUID",
            "Ada index pada (user_id, created_at DESC)",
          ],
          progressive_hints: {
            architecture: "Pisahkan tabel ledger_entries dari summary balance.",
            pseudocode: "CREATE TABLE ...; CREATE INDEX ...;",
            implementation:
              "CREATE TABLE ledger_entries (id uuid primary key, user_id uuid not null);",
          },
        },
      };
    });

    const result = await generateModuleContent(BASE_CONTEXT, mockAi);

    expect(mockAi).toHaveBeenCalledTimes(1);
    expect(seenPrompt).toContain("OrderLedger Hub");
    expect(seenPrompt).toContain("PostgreSQL Indexing Guide");
    expect(result.concept_brief.key_points).toHaveLength(2);
    expect(result.warmup_drills[0]?.blanks).toHaveLength(2);
    expect(result.hands_on_ticket.progressive_hints.implementation).toContain(
      "CREATE TABLE",
    );
  });

  it("rejects warmup drills missing ___<id>___ placeholder inside code_template", async () => {
    const mockAi = vi.fn<GenerateModuleContentFn>(async () => ({
      concept_brief: {
        summary: "Ringkasan.",
        analogy: "Analogi.",
        key_points: ["Poin 1"],
      },
      warmup_drills: [
        {
          title: "Broken Placeholder",
          language: "sql",
          code_template: "SELECT * FROM orders;",
          blanks: [{ id: "BLANK_1", answer: "orders" }],
        },
      ],
      hands_on_ticket: {
        problem_context: "Konteks.",
        acceptance_criteria: ["Kriteria 1"],
        progressive_hints: {
          architecture: "Arsitektur",
          pseudocode: "Pseudocode",
          implementation: "Implementasi",
        },
      },
    }));

    await expect(generateModuleContent(BASE_CONTEXT, mockAi)).rejects.toThrow(
      /placeholder/i,
    );
  });

  it("propagates GeminiRateLimitError on 429", async () => {
    const mockAi = vi.fn<GenerateModuleContentFn>(async () => {
      throw new GeminiRateLimitError();
    });

    await expect(
      generateModuleContent(BASE_CONTEXT, mockAi),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });
});
