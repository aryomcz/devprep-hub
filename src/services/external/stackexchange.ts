const REQUEST_TIMEOUT_MS = 4000;

export type StackExchangeLookupItem = {
  source: "stackoverflow";
  title: string;
  url: string;
  summary: string;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function fetchStackExchangeResources(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<StackExchangeLookupItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url =
    `https://api.stackexchange.com/2.3/search/advanced` +
    `?order=desc&sort=votes&q=${encodeURIComponent(trimmed)}&site=stackoverflow&pagesize=3`;

  const res = await fetchFn(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "dev-prep-hub",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: Array<{
      title?: string;
      link?: string;
      score?: number;
      answer_count?: number;
    }>;
  };

  return (data.items ?? [])
    .filter((item): item is { title: string; link: string; score?: number; answer_count?: number } =>
      Boolean(item.title && item.link),
    )
    .map((item) => ({
      source: "stackoverflow" as const,
      title: decodeHtmlEntities(item.title),
      url: item.link,
      summary: `Stack Overflow (${item.score ?? 0} votes${
        item.answer_count !== undefined ? `, ${item.answer_count} answers` : ""
      })`,
    }));
}
