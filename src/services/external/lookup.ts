import { fetchStackExchangeResources } from "@/services/external/stackexchange";
import {
  fetchMdnResources,
  fetchWikipediaResources,
} from "@/services/external/wikipedia";
import type { ResourceSource } from "@/types/database";

export type LookupResource = {
  source: ResourceSource;
  title: string;
  url: string;
  summary: string;
};

export type LookupAdapter = (query: string) => Promise<LookupResource[]>;

export type LookupOptions = {
  fetchFn?: typeof fetch;
  adapters?: LookupAdapter[];
};

export async function lookupTechnicalTerm(
  query: string,
  options: LookupOptions = {},
): Promise<LookupResource[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const fetchFn = options.fetchFn ?? fetch;
  const adapters: LookupAdapter[] = options.adapters ?? [
    (q) => fetchWikipediaResources(q, fetchFn),
    (q) => fetchMdnResources(q, fetchFn),
    (q) => fetchStackExchangeResources(q, fetchFn),
  ];

  const settled = await Promise.allSettled(
    adapters.map((adapter) => adapter(trimmed)),
  );

  const deduped = new Map<string, LookupResource>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      if (!item.url || deduped.has(item.url)) continue;
      deduped.set(item.url, item);
    }
  }

  return Array.from(deduped.values());
}
