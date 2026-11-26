import { describe, expect, it, vi } from "vitest";
import {
  curateDailyDigestForUser,
  type DigestSkillTarget,
} from "@/services/external/daily-digest";

const SKILLS: DigestSkillTarget[] = [
  { id: "skill-pg", name: "PostgreSQL", slug: "postgresql", status: "gap" },
  {
    id: "skill-go",
    name: "Go",
    slug: "go",
    status: "learning",
  },
  {
    id: "skill-ts",
    name: "TypeScript",
    slug: "typescript",
    status: "mastered",
  },
];

describe("curateDailyDigestForUser", () => {
  it("picks 1-2 matched articles for gap/learning skills and sets matched_skill_id", async () => {
    const result = await curateDailyDigestForUser(SKILLS, {
      adapters: {
        fetchDevToByTag: vi.fn(async (tag) =>
          tag === "postgresql"
            ? [
                {
                  source: "devto" as const,
                  externalId: "dev-101",
                  title: "PostgreSQL Query Tuning Tips",
                  url: "https://dev.to/pg/tuning",
                  tags: ["postgresql", "sql"],
                },
              ]
            : [],
        ),
        fetchHackerNews: vi.fn(async () => [
          {
            source: "hackernews" as const,
            externalId: "hn-202",
            title: "Why Go channels scale well",
            url: "https://news.ycombinator.com/item?id=202",
            tags: [],
          },
          {
            source: "hackernews" as const,
            externalId: "hn-303",
            title: "Unrelated cooking story",
            url: "https://example.com/cook",
            tags: [],
          },
        ]),
      },
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.matched_skill_id)).toEqual([
      "skill-go",
      "skill-pg",
    ]);
  });

  it("survives partial source failure when Hacker News rejects", async () => {
    const result = await curateDailyDigestForUser(SKILLS, {
      adapters: {
        fetchHackerNews: vi.fn(async () => {
          throw new DOMException("Aborted", "TimeoutError");
        }),
        fetchDevToByTag: vi.fn(async () => [
          {
            source: "devto" as const,
            externalId: "dev-55",
            title: "PostgreSQL Indexing",
            url: "https://dev.to/pg/indexing",
            tags: ["postgresql"],
          },
        ]),
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.matched_skill_id).toBe("skill-pg");
  });

  it("returns empty array when user has no gap or learning skills", async () => {
    const fetchHn = vi.fn();
    const result = await curateDailyDigestForUser(
      [{ id: "s1", name: "TypeScript", slug: "typescript", status: "mastered" }],
      { adapters: { fetchHackerNews: fetchHn } },
    );

    expect(result).toEqual([]);
    expect(fetchHn).not.toHaveBeenCalled();
  });

  it("avoids substring false-positives (Go vs Google) and excludes unmatched or unsafe URLs", async () => {
    const result = await curateDailyDigestForUser(
      [{ id: "skill-go", name: "Go", slug: "go", status: "gap" }],
      {
        adapters: {
          fetchDevToByTag: vi.fn(async () => []),
          fetchHackerNews: vi.fn(async () => [
            {
              source: "hackernews" as const,
              externalId: "hn-google",
              title: "Google releases new quantum chip",
              url: "https://example.com/google",
              tags: [],
            },
            {
              source: "hackernews" as const,
              externalId: "hn-xss",
              title: "Go concurrency patterns",
              url: "javascript:alert(1)",
              tags: [],
            },
          ]),
        },
      },
    );

    expect(result).toEqual([]);
  });
});
