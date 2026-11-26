import { describe, expect, it, vi } from "vitest";
import { fetchDevToResources } from "@/services/external/devto";
import {
  getOrFetchCuratedResources,
  type CachedCuratedResource,
  type CuratedResourceStoreAdapter,
  type SourcedResourceItem,
} from "@/services/external/hybrid-sourcing";

function createInMemoryStore(
  initial: CachedCuratedResource[] = [],
): CuratedResourceStoreAdapter {
  let rows = [...initial];
  return {
    getBySkillId: vi.fn(async (skillId: string) =>
      rows.filter((row) => row.skill_id === skillId),
    ),
    upsertForSkill: vi.fn(
      async (
        skillId: string,
        items: Array<SourcedResourceItem & { fetched_at: string }>,
      ) => {
        const byUrl = new Map(rows.map((r) => [`${r.skill_id}:${r.url}`, r]));
        for (const item of items) {
          byUrl.set(`${skillId}:${item.url}`, {
            ...item,
            skill_id: skillId,
          });
        }
        rows = Array.from(byUrl.values());
        return rows.filter((row) => row.skill_id === skillId);
      },
    ),
  };
}

describe("fetchDevToResources", () => {
  it("fetches tagged articles from Dev.to with 4s AbortSignal", async () => {
    let seenUrl = "";
    let seenSignal: AbortSignal | null | undefined;

    const mockFetch: typeof fetch = vi.fn(async (input, init) => {
      seenUrl = typeof input === "string" ? input : input.toString();
      seenSignal = init?.signal;
      return new Response(
        JSON.stringify([
          {
            title: "PostgreSQL Indexing Guide",
            url: "https://dev.to/alice/postgresql-indexing",
            description: "B-Tree vs GIN indexes explained.",
          },
        ]),
        { status: 200 },
      );
    });

    const results = await fetchDevToResources("PostgreSQL", mockFetch);

    expect(seenUrl).toContain("https://dev.to/api/articles?tag=postgresql");
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(results).toMatchObject([
      {
        source: "devto",
        title: "PostgreSQL Indexing Guide",
        url: "https://dev.to/alice/postgresql-indexing",
        summary: "B-Tree vs GIN indexes explained.",
      },
    ]);
  });
});

describe("getOrFetchCuratedResources", () => {
  const now = new Date("2026-11-26T12:00:00.000Z");

  it("returns cached resources (< 7 days old) without calling external source adapters", async () => {
    const store = createInMemoryStore([
      {
        skill_id: "skill-1",
        source: "devto",
        title: "Cached Article",
        url: "https://dev.to/cached/article",
        summary: "Still fresh.",
        fetched_at: "2026-11-23T12:00:00.000Z", // 3 days old
      },
    ]);

    const devto = vi.fn();
    const stackexchange = vi.fn();
    const wikipedia = vi.fn();
    const mdn = vi.fn();

    const results = await getOrFetchCuratedResources(
      { skillId: "skill-1", skillName: "PostgreSQL", skillSlug: "postgresql" },
      store,
      {
        now,
        sourceAdapters: { devto, stackexchange, wikipedia, mdn },
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Cached Article");
    expect(devto).not.toHaveBeenCalled();
    expect(stackexchange).not.toHaveBeenCalled();
    expect(wikipedia).not.toHaveBeenCalled();
    expect(mdn).not.toHaveBeenCalled();
    expect(store.upsertForSkill).not.toHaveBeenCalled();
  });

  it("refreshes expired (> 7 days) cache via parallel adapters, survives failures, and deduplicates URLs", async () => {
    const store = createInMemoryStore([
      {
        skill_id: "skill-2",
        source: "wikipedia",
        title: "Stale Entry",
        url: "https://en.wikipedia.org/wiki/Old",
        summary: "Expired.",
        fetched_at: "2026-11-10T12:00:00.000Z", // 16 days old
      },
    ]);

    const sharedUrl = "https://developer.mozilla.org/en-US/docs/Web/CSS/Grid";

    const results = await getOrFetchCuratedResources(
      { skillId: "skill-2", skillName: "CSS Grid", skillSlug: "css-grid" },
      store,
      {
        now,
        sourceAdapters: {
          devto: vi.fn(async () => [
            {
              source: "devto" as const,
              title: "CSS Grid Cheat Sheet",
              url: "https://dev.to/css/grid",
              summary: "Two-dimensional CSS layout.",
            },
            {
              source: "devto" as const,
              title: "Duplicate MDN Link",
              url: sharedUrl,
              summary: "Should be deduplicated.",
            },
          ]),
          mdn: vi.fn(async () => [
            {
              source: "mdn" as const,
              title: "MDN CSS Grid Layout",
              url: sharedUrl,
              summary: "Official MDN reference.",
            },
          ]),
          wikipedia: vi.fn(async () => {
            throw new DOMException("Aborted", "TimeoutError");
          }),
          stackexchange: vi.fn(async () => {
            throw new Error("HTTP 500");
          }),
        },
      },
    );

    expect(store.upsertForSkill).toHaveBeenCalledTimes(1);
    const urls = results.map((r) => r.url);
    expect(urls).toContain("https://dev.to/css/grid");
    expect(urls).toContain(sharedUrl);
    expect(urls.filter((u) => u === sharedUrl)).toHaveLength(1);
  });

  it("wires default Wikipedia, MDN, Stack Exchange, and Dev.to adapters through injected fetchFn", async () => {
    const store = createInMemoryStore();
    const signals: Array<AbortSignal | null | undefined> = [];

    const mockFetch: typeof fetch = vi.fn(async (input, init) => {
      signals.push(init?.signal);
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("dev.to/api/articles")) {
        return new Response(
          JSON.stringify([
            {
              title: "TypeScript Utility Types",
              url: "https://dev.to/ts/utilities",
              description: "Partial, Pick, Omit.",
            },
          ]),
          { status: 200 },
        );
      }
      if (url.includes("en.wikipedia.org")) {
        return new Response("Not Found", { status: 404 });
      }
      if (url.includes("developer.mozilla.org")) {
        return new Response(JSON.stringify({ documents: [] }), { status: 200 });
      }
      if (url.includes("api.stackexchange.com")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                title: "Difference between interface and type in TypeScript?",
                link: "https://stackoverflow.com/questions/37233735/interface-vs-type",
                score: 2100,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Error", { status: 500 });
    });

    const results = await getOrFetchCuratedResources(
      { skillId: "skill-3", skillName: "TypeScript", skillSlug: "typescript" },
      store,
      { now, fetchFn: mockFetch },
    );

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.source).sort()).toEqual([
      "devto",
      "stackoverflow",
    ]);
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
  });
});
