import { fetchDevToResources } from "@/services/external/devto";
import { isSafeHttpUrl } from "@/services/external/hackernews";
import { fetchStackExchangeResources } from "@/services/external/stackexchange";
import {
  fetchMdnResources,
  fetchWikipediaResources,
} from "@/services/external/wikipedia";
import type { CachedCuratedResource, ResourceSource } from "@/types/database";

export type { CachedCuratedResource };

export const RESOURCE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SourcedResourceItem = {
  source: ResourceSource;
  title: string;
  url: string;
  summary: string;
};

export type CuratedResourceStoreAdapter = {
  getBySkillId(skillId: string): Promise<CachedCuratedResource[]>;
  upsertForSkill(
    skillId: string,
    items: Array<SourcedResourceItem & { fetched_at: string }>,
  ): Promise<CachedCuratedResource[]>;
};

export type HybridSourceInput = {
  skillId: string;
  skillName: string;
  skillSlug: string;
};

export type HybridSourceAdapters = {
  devto?: (tagOrQuery: string) => Promise<SourcedResourceItem[]>;
  stackexchange?: (query: string) => Promise<SourcedResourceItem[]>;
  wikipedia?: (query: string) => Promise<SourcedResourceItem[]>;
  mdn?: (query: string) => Promise<SourcedResourceItem[]>;
};

export type HybridSourcingOptions = {
  sourceAdapters?: HybridSourceAdapters;
  fetchFn?: typeof fetch;
  now?: Date;
};

function stripExtraFields(items: SourcedResourceItem[]): SourcedResourceItem[] {
  return items.map(({ source, title, url, summary }) => ({
    source,
    title,
    url,
    summary,
  }));
}

export async function getOrFetchCuratedResources(
  input: HybridSourceInput,
  storeAdapter: CuratedResourceStoreAdapter,
  options: HybridSourcingOptions = {},
): Promise<CachedCuratedResource[]> {
  const now = options.now ?? new Date();
  const freshCutoffMs = now.getTime() - RESOURCE_CACHE_TTL_MS;

  const cached = await storeAdapter.getBySkillId(input.skillId);
  const freshCached = cached.filter((row) => {
    const parsedTime = Date.parse(row.fetched_at);
    return Number.isFinite(parsedTime) && parsedTime >= freshCutoffMs;
  });

  if (freshCached.length > 0) {
    return freshCached;
  }

  const fetchFn = options.fetchFn ?? fetch;
  const adapters = options.sourceAdapters;

  const devtoFn =
    adapters?.devto ??
    (async (tag: string) =>
      stripExtraFields(await fetchDevToResources(tag, fetchFn)));
  const stackFn =
    adapters?.stackexchange ??
    ((query: string) => fetchStackExchangeResources(query, fetchFn));
  const wikiFn =
    adapters?.wikipedia ??
    ((query: string) => fetchWikipediaResources(query, fetchFn));
  const mdnFn =
    adapters?.mdn ?? ((query: string) => fetchMdnResources(query, fetchFn));

  const settled = await Promise.allSettled([
    devtoFn(input.skillSlug || input.skillName),
    wikiFn(input.skillName),
    mdnFn(input.skillName),
    stackFn(input.skillName),
  ]);

  const deduped = new Map<string, SourcedResourceItem>();
  for (const outcome of settled) {
    if (outcome.status !== "fulfilled") continue;
    for (const item of outcome.value) {
      if (!item.url || !isSafeHttpUrl(item.url) || deduped.has(item.url)) {
        continue;
      }
      deduped.set(item.url, {
        source: item.source,
        title: item.title,
        url: item.url,
        summary: item.summary,
      });
    }
  }

  const fetchedAt = now.toISOString();
  const toPersist = Array.from(deduped.values()).map((item) => ({
    ...item,
    fetched_at: fetchedAt,
  }));

  if (toPersist.length === 0) {
    return [];
  }

  return storeAdapter.upsertForSkill(input.skillId, toPersist);
}
