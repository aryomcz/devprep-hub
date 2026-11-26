import { isSafeHttpUrl } from "@/services/external/hackernews";

const REQUEST_TIMEOUT_MS = 4000;

export type DevToResourceItem = {
  source: "devto";
  title: string;
  url: string;
  summary: string;
  tags: string[];
  externalId: string;
};

export async function fetchDevToResources(
  tagOrQuery: string,
  fetchFn: typeof fetch = fetch,
): Promise<DevToResourceItem[]> {
  const cleanTag = tagOrQuery
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!cleanTag) return [];

  const res = await fetchFn(
    `https://dev.to/api/articles?tag=${encodeURIComponent(cleanTag)}&top=30&per_page=3`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "dev-prep-hub",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    id?: number | string;
    title?: string;
    url?: string;
    description?: string;
    tag_list?: string[];
  }>;

  if (!Array.isArray(data)) return [];

  return data
    .filter((item): item is { id?: number | string; title: string; url: string; description?: string; tag_list?: string[] } =>
      Boolean(item.title && item.url && isSafeHttpUrl(item.url)),
    )
    .map((item) => ({
      source: "devto" as const,
      title: item.title.trim(),
      url: item.url,
      summary: item.description?.trim() ?? "",
      tags: Array.isArray(item.tag_list) ? item.tag_list : [],
      externalId: String(item.id ?? item.url),
    }));
}
