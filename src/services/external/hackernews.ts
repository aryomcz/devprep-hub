const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";
const REQUEST_TIMEOUT_MS = 4000;
const CONCURRENCY_LIMIT = 4;

export type HackerNewsStory = {
  source: "hackernews";
  externalId: string;
  title: string;
  url: string;
  tags: string[];
};

export function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchHackerNewsTopStories(
  fetchFn: typeof fetch = fetch,
  maxStories = 12,
): Promise<HackerNewsStory[]> {
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  const idsRes = await fetchFn(`${HN_API_BASE}/topstories.json`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!idsRes.ok) return [];

  const ids = (await idsRes.json()) as unknown;
  if (!Array.isArray(ids)) return [];

  const targetIds = ids
    .filter((id): id is number => typeof id === "number")
    .slice(0, maxStories);

  const stories: HackerNewsStory[] = [];
  for (let i = 0; i < targetIds.length; i += CONCURRENCY_LIMIT) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    const batch = targetIds.slice(i, i + CONCURRENCY_LIMIT);
    const settled = await Promise.allSettled(
      batch.map(async (id): Promise<HackerNewsStory | null> => {
        const budgetMs = Math.max(50, deadline - Date.now());
        const itemRes = await fetchFn(`${HN_API_BASE}/item/${id}.json`, {
          signal: AbortSignal.timeout(budgetMs),
        });
        if (!itemRes.ok) return null;

        const item = (await itemRes.json()) as {
          id?: number;
          title?: string;
          url?: string;
          type?: string;
        } | null;

        if (
          !item?.title ||
          !item.url ||
          item.type !== "story" ||
          !isSafeHttpUrl(item.url)
        ) {
          return null;
        }

        return {
          source: "hackernews",
          externalId: String(item.id ?? id),
          title: item.title.trim(),
          url: item.url,
          tags: [],
        };
      }),
    );

    for (const outcome of settled) {
      if (outcome.status === "fulfilled" && outcome.value !== null) {
        stories.push(outcome.value);
      }
    }
  }

  return stories;
}
