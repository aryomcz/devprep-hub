import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { GeminiRateLimitError, generateStructuredJson } from "@/lib/gemini";
import {
  MAX_RAW_JD_CHARS,
  analyzeInternshipInput,
  type GenerateAnalysisFn,
} from "@/services/ai/jd-analyzer";

describe("analyzeInternshipInput", () => {
  it("rejects raw JD exceeding 15,000 characters without calling Gemini", async () => {
    const generateFn = vi.fn<GenerateAnalysisFn>();
    const oversizedJd = "a".repeat(MAX_RAW_JD_CHARS + 1);

    await expect(
      analyzeInternshipInput(
        {
          mode: "raw_jd",
          title: "Backend Intern",
          company_name: "Acme",
          industry: "Fintech",
          raw_input: oversizedJd,
        },
        [],
        generateFn,
      ),
    ).rejects.toThrow(/15\.000|15,000|15000/);

    expect(generateFn).not.toHaveBeenCalled();
  });

  it("injects existing skills into prompt and maps extracted aliases to existing skills", async () => {
    let capturedPrompt = "";
    const generateFn = vi.fn<GenerateAnalysisFn>(async (prompt) => {
      capturedPrompt = prompt;
      return {
        skills: [
          { name: "Postgres", category: "tool", priority: "must_have" },
          { name: "NextJS", category: "framework", priority: "nice_to_have" },
        ],
        jargon_glossary: [
          {
            term: "ACID",
            definition: "Properti keandalan transaksi database.",
            context: "Transaksi ledger fintech.",
          },
        ],
      };
    });

    const result = await analyzeInternshipInput(
      {
        mode: "role_industry",
        title: "Fullstack Intern",
        company_name: "FinPay",
        role: "Fullstack Engineer",
        industry: "Fintech",
      },
      [
        { slug: "postgresql", name: "PostgreSQL" },
        { slug: "nextjs", name: "Next.js 16" },
      ],
      generateFn,
    );

    expect(generateFn).toHaveBeenCalledTimes(1);
    expect(capturedPrompt).toContain("PostgreSQL (slug: postgresql)");
    expect(capturedPrompt).toContain("Next.js 16 (slug: nextjs)");

    expect(result.skills).toEqual([
      {
        name: "PostgreSQL",
        slug: "postgresql",
        category: "tool",
        priority: "must_have",
      },
      {
        name: "Next.js 16",
        slug: "nextjs",
        category: "framework",
        priority: "nice_to_have",
      },
    ]);
  });

  it("deduplicates aliases via skill-normalizer, upgrades priority collisions to must_have, and filters soft skills", async () => {
    const generateFn = vi.fn<GenerateAnalysisFn>(async () => ({
      skills: [
        { name: "Postgres", category: "tool", priority: "nice_to_have" },
        { name: "PostgreSQL", category: "concept", priority: "must_have" },
        { name: "C++", category: "language", priority: "must_have" },
        { name: "Team Player", category: "concept", priority: "must_have" },
        {
          name: "Good Communication",
          category: "concept",
          priority: "nice_to_have",
        },
      ],
      jargon_glossary: [],
    }));

    const result = await analyzeInternshipInput(
      {
        mode: "manual_skills",
        title: "Systems Intern",
        company_name: "",
        industry: "Cloud",
        skills: ["PostgreSQL", "C++"],
      },
      [],
      generateFn,
    );

    expect(result.skills).toEqual([
      {
        name: "PostgreSQL",
        slug: "postgresql",
        category: "concept",
        priority: "must_have",
      },
      {
        name: "C++",
        slug: "cpp",
        category: "language",
        priority: "must_have",
      },
    ]);
  });

  it("propagates GeminiRateLimitError on HTTP 429 after at most 1 lightweight retry", async () => {
    const mockFetch = vi.fn<typeof fetch>(async () => {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "retry-after": "3" },
      });
    });

    const rateLimitedGenerate: GenerateAnalysisFn = (prompt) =>
      generateStructuredJson({
        prompt,
        schema: z.object({
          skills: z.array(
            z.object({
              name: z.string(),
              category: z.enum(["language", "framework", "concept", "tool"]),
              priority: z.enum(["must_have", "nice_to_have"]),
            }),
          ),
          jargon_glossary: z.array(
            z.object({
              term: z.string(),
              definition: z.string(),
              context: z.string(),
            }),
          ),
        }),
        apiKey: "test-server-key",
        maxRetries: 1,
        retryDelayMs: 0,
        fetchFn: mockFetch,
      });

    await expect(
      analyzeInternshipInput(
        {
          mode: "raw_jd",
          title: "Backend Intern",
          company_name: "Acme",
          industry: "SaaS",
          raw_input: "Need TypeScript and PostgreSQL experience.",
        },
        [],
        rateLimitedGenerate,
      ),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
