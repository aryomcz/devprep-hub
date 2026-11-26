const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";
const REQUEST_TIMEOUT_MS = 4000;

export type HackerNewsStory = {
  source: "hackernews";
  externalId: string;
  title: string;
  url: string;
  tags: string[];
};

export async function fetchHackerNewsTopStories(
  fetchFn: typeof fetch = fetch,
  maxStories = 12,
): Promise<HackerNewsStory[]> {
  const idsRes = await fetchFn(`${HN_API_BASE}/topstories.json`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!idsRes.ok) return [];

  const ids = (await idsRes.json()) as unknown;
  if (!Array.isArray(ids)) return [];

  const targetIds = ids
    .filter((id): id is number => typeof id === "number")
    .slice(0, maxStories);

  const settled = await Promise.allSettled(
    targetIds.map(async (id): Promise<HackerNewsStory | null> => {
      const itemRes = await fetchFn(`${HN_API_BASE}/item/${id}.json`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!itemRes.ok) return null;

      const item = (await itemRes.json()) as {
        id?: number;
        title?: string;
        url?: string;
        type?: string;
      } | null;

      if (!item?.title || !item.url || item.type !== "story") {
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

  return settled
    .filter(
      (outcome): outcome is PromiseFulfilledResult<HackerNewsStory | null> =>
        outcome.status === "fulfilled",
    )
    .map((outcome) => outcome.value)
    .filter((story): story is HackerNewsStory => story !== null);
}
