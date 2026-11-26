import { describe, expect, it, vi } from "vitest";
import { GeminiRateLimitError } from "@/lib/gemini";
import {
  generateTrackBlueprint,
  type GenerateBlueprintFn,
  type TrackSkillCandidate,
} from "@/services/ai/track-generator";

const SAMPLE_SKILLS: TrackSkillCandidate[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "TypeScript",
    slug: "typescript",
    category: "language",
    status: "learning",
    priority: "must_have",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "PostgreSQL",
    slug: "postgresql",
    category: "tool",
    status: "gap",
    priority: "must_have",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Go",
    slug: "go",
    category: "language",
    status: "gap",
    priority: "nice_to_have",
  },
];

describe("generateTrackBlueprint", () => {
  it("rejects empty skill list without calling AI adapter", async () => {
    const mockAi = vi.fn<GenerateBlueprintFn>();

    await expect(
      generateTrackBlueprint({ skills: [] }, mockAi),
    ).rejects.toThrow(/minimal 1 skill/i);

    expect(mockAi).not.toHaveBeenCalled();
  });

  it("maps skill slugs to skill_ids, normalizes sequential order_index, and enforces microservice/language_native classification", async () => {
    const mockAi = vi.fn<GenerateBlueprintFn>(async () => ({
      capstone_title: "OrderLedger Hub",
      capstone_description:
        "Platform pemrosesan transaksi dan analitik pesanan.",
      primary_stack: "TypeScript + Next.js",
      architecture_overview:
        "Monolith modular TypeScript dengan layanan worker terpisah.",
      modules: [
        {
          skill_slug: "go",
          order_index: 30,
          module_type: "capstone_feature", // non-primary language should respect languageMode
          target_language: "Go",
          objective: "Bangun worker antrean notifikasi berkinerja tinggi.",
        },
        {
          skill_slug: "typescript",
          order_index: 10,
          module_type: "microservice", // primary language should stay capstone_feature
          target_language: "TypeScript",
          objective: "Susun kontrak API dan validasi domain inti.",
        },
        {
          skill_slug: "postgres", // alias normalized to postgresql
          order_index: 20,
          module_type: "microservice", // tool must become capstone_feature
          target_language: "SQL",
          objective: "Rancang skema relasional dan index transaksi.",
        },
      ],
    }));

    const result = await generateTrackBlueprint(
      {
        internshipTitle: "Backend Engineer Intern",
        skills: SAMPLE_SKILLS,
        languageMode: "language_native",
      },
      mockAi,
    );

    expect(mockAi).toHaveBeenCalledTimes(1);
    expect(result.modules.map((m) => m.order_index)).toEqual([1, 2, 3]);
    expect(result.modules).toEqual([
      {
        skill_id: "11111111-1111-4111-8111-111111111111",
        order_index: 1,
        module_type: "capstone_feature",
        target_language: "TypeScript",
        objective: "Susun kontrak API dan validasi domain inti.",
      },
      {
        skill_id: "22222222-2222-4222-8222-222222222222",
        order_index: 2,
        module_type: "capstone_feature",
        target_language: "SQL",
        objective: "Rancang skema relasional dan index transaksi.",
      },
      {
        skill_id: "33333333-3333-4333-8333-333333333333",
        order_index: 3,
        module_type: "language_native",
        target_language: "Go",
        objective: "Bangun worker antrean notifikasi berkinerja tinggi.",
      },
    ]);
  });

  it("defaults secondary languages to microservice mode when languageMode is omitted", async () => {
    const mockAi = vi.fn<GenerateBlueprintFn>(async () => ({
      capstone_title: "FleetTrack Core",
      capstone_description: "Pelacakan armada dan telemetri logistik.",
      primary_stack: "TypeScript",
      architecture_overview: "Gateway TypeScript + service Go.",
      modules: [
        {
          skill_slug: "go",
          order_index: 1,
          module_type: "microservice",
          target_language: "Go",
          objective: "Inisiasi service ingest telemetri.",
        },
      ],
    }));

    const result = await generateTrackBlueprint(
      { skills: [SAMPLE_SKILLS[2]] },
      mockAi,
    );

    expect(result.modules[0]?.module_type).toBe("microservice");
  });

  it("propagates GeminiRateLimitError on HTTP 429", async () => {
    const mockAi = vi.fn<GenerateBlueprintFn>(async () => {
      throw new GeminiRateLimitError();
    });

    await expect(
      generateTrackBlueprint({ skills: SAMPLE_SKILLS }, mockAi),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });
});
