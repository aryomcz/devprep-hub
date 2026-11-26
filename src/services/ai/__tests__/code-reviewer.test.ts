import { describe, expect, it, vi } from "vitest";
import { GeminiRateLimitError } from "@/lib/gemini";
import {
  reviewLabSubmission,
  type GenerateLabReviewFn,
  type LabReviewInput,
} from "@/services/ai/code-reviewer";

const SAMPLE_INPUT: LabReviewInput = {
  skillName: "PostgreSQL",
  targetLanguage: "SQL",
  objective: "Rancang tabel ledger transaksi dengan constraint.",
  acceptanceCriteria: [
    "Memiliki primary key UUID",
    "Memiliki index pada (user_id, created_at DESC)",
  ],
  submittedCodeOrDiff: [
    "diff --git a/package-lock.json b/package-lock.json",
    "+noise",
    "diff --git a/supabase/migrations/0003_ledger.sql b/supabase/migrations/0003_ledger.sql",
    "+create table ledger (id uuid primary key, user_id uuid not null, created_at timestamptz);",
  ].join("\n"),
};

describe("reviewLabSubmission", () => {
  it("evaluates sanitized code against acceptance criteria and returns 2 interview questions", async () => {
    let capturedPrompt = "";
    const mockAi = vi.fn<GenerateLabReviewFn>(async (prompt) => {
      capturedPrompt = prompt;
      return {
        passed: true,
        feedback: {
          criteria_met: ["Primary key UUID sudah diterapkan"],
          improvements: ["Tambahkan composite index (user_id, created_at desc)"],
          summary: "Struktur dasar sudah rapi, tinggal lengkapi index.",
        },
        interview_questions: [
          "Mengapa memilih UUID dibanding bigint serial untuk tabel ledger?",
          "Bagaimana composite index (user_id, created_at DESC) mempercepat query riwayat?",
        ],
      };
    });

    const result = await reviewLabSubmission(SAMPLE_INPUT, mockAi);

    expect(mockAi).toHaveBeenCalledTimes(1);
    expect(capturedPrompt).not.toContain("+noise");
    expect(capturedPrompt).toContain("0003_ledger.sql");
    expect(result.passed).toBe(true);
    expect(result.interview_questions).toHaveLength(2);
  });

  it("rejects empty submission without calling AI adapter", async () => {
    const mockAi = vi.fn<GenerateLabReviewFn>();

    await expect(
      reviewLabSubmission(
        { ...SAMPLE_INPUT, submittedCodeOrDiff: "   " },
        mockAi,
      ),
    ).rejects.toThrow(/kosong/i);

    expect(mockAi).not.toHaveBeenCalled();
  });

  it("rejects AI output that does not return exactly 2 interview questions", async () => {
    const mockAi = vi.fn(async () => ({
      passed: false,
      feedback: {
        criteria_met: [],
        improvements: ["Belum ada kode"],
        summary: "Perlu revisi.",
      },
      interview_questions: ["Hanya satu pertanyaan"],
    })) as unknown as GenerateLabReviewFn;

    await expect(reviewLabSubmission(SAMPLE_INPUT, mockAi)).rejects.toThrow();
  });

  it("propagates GeminiRateLimitError on 429", async () => {
    const mockAi = vi.fn<GenerateLabReviewFn>(async () => {
      throw new GeminiRateLimitError();
    });

    await expect(
      reviewLabSubmission(SAMPLE_INPUT, mockAi),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });
});
