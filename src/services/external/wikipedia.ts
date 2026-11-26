import { isSafeHttpUrl } from "@/services/external/hackernews";

const REQUEST_TIMEOUT_MS = 4000;

export type WikipediaLookupItem = {
  source: "wikipedia" | "mdn";
  title: string;
  url: string;
  summary: string;
};

export async function fetchWikipediaResources(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<WikipediaLookupItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const slug = encodeURIComponent(trimmed.replace(/\s+/g, "_"));
  const res = await fetchFn(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "dev-prep-hub",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!res.ok) return [];

  const data = (await res.json()) as {
    title?: string;
    extract?: string;
    type?: string;
    content_urls?: { desktop?: { page?: string } };
  };

  const url = data.content_urls?.desktop?.page;
  if (
    !data.title ||
    !data.extract ||
    !url ||
    !isSafeHttpUrl(url) ||
    data.type === "disambiguation"
  ) {
    return [];
  }

  return [
    {
      source: "wikipedia",
      title: data.title,
      url,
      summary: data.extract,
    },
  ];
}

export async function fetchMdnResources(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<WikipediaLookupItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetchFn(
    `https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(trimmed)}&size=2`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "dev-prep-hub",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!res.ok) return [];

  const data = (await res.json()) as {
    documents?: Array<{
      title?: string;
      mdn_url?: string;
      summary?: string;
    }>;
  };

  return (data.documents ?? [])
    .filter(
      (doc): doc is { title: string; mdn_url: string; summary?: string } =>
        Boolean(doc.title && doc.mdn_url),
    )
    .map((doc) => ({
      source: "mdn" as const,
      title: doc.title,
      url: doc.mdn_url.startsWith("http")
        ? doc.mdn_url
        : `https://developer.mozilla.org${doc.mdn_url}`,
      summary: doc.summary?.trim() ?? "",
    }))
    .filter((item) => isSafeHttpUrl(item.url));
}
