import { fetchDevToResources } from "@/services/external/devto";
import {
  fetchHackerNewsTopStories,
  isSafeHttpUrl,
} from "@/services/external/hackernews";
import type { DigestSource, SkillStatus } from "@/types/database";

export type DigestSkillTarget = {
  id: string;
  name: string;
  slug: string;
  status: SkillStatus;
};

export type DigestCandidateArticle = {
  source: DigestSource;
  externalId: string;
  title: string;
  url: string;
  tags: string[];
};

export type CuratedDigestEntry = {
  source: DigestSource;
  external_id: string;
  title: string;
  url: string;
  tags: string[];
  matched_skill_id: string;
};

export type DigestAdapters = {
  fetchDevToByTag?: (tag: string) => Promise<DigestCandidateArticle[]>;
  fetchHackerNews?: () => Promise<DigestCandidateArticle[]>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWholeTerm(haystack: string, term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(
    `(^|[^a-z0-9+#.])${escapeRegExp(trimmed)}([^a-z0-9+#.]|$)`,
    "i",
  );
  return pattern.test(haystack);
}

function findMatchedSkill(
  article: DigestCandidateArticle,
  targetSkills: DigestSkillTarget[],
): DigestSkillTarget | null {
  const tagSet = new Set(article.tags.map((t) => t.toLowerCase()));

  for (const skill of targetSkills) {
    const slugLower = skill.slug.toLowerCase();
    const compactSlug = slugLower.replace(/-/g, "");

    if (
      tagSet.has(slugLower) ||
      tagSet.has(compactSlug) ||
      containsWholeTerm(article.title, skill.name) ||
      containsWholeTerm(article.title, skill.slug)
    ) {
      return skill;
    }
  }
  return null;
}

export async function curateDailyDigestForUser(
  skills: DigestSkillTarget[],
  options: { adapters?: DigestAdapters; fetchFn?: typeof fetch; limit?: number } = {},
): Promise<CuratedDigestEntry[]> {
  const targetSkills = skills
    .filter((skill) => skill.status === "gap" || skill.status === "learning")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "gap" ? -1 : 1));
  if (targetSkills.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(2, options.limit ?? 2));
  const fetchFn = options.fetchFn ?? fetch;
  const fetchDevToFn =
    options.adapters?.fetchDevToByTag ??
    ((tag: string) => fetchDevToResources(tag, fetchFn));
  const fetchHnFn =
    options.adapters?.fetchHackerNews ??
    (() => fetchHackerNewsTopStories(fetchFn, 12));

  const seedTags = targetSkills.slice(0, 3).map((s) => s.slug);

  const settled = await Promise.allSettled([
    fetchHnFn(),
    ...seedTags.map((tag) => fetchDevToFn(tag)),
  ]);

  const candidatesByUrl = new Map<string, DigestCandidateArticle>();
  for (const outcome of settled) {
    if (outcome.status !== "fulfilled") continue;
    for (const article of outcome.value) {
      if (
        !article.url ||
        !isSafeHttpUrl(article.url) ||
        candidatesByUrl.has(article.url)
      ) {
        continue;
      }
      candidatesByUrl.set(article.url, article);
    }
  }

  const matchedEntries: CuratedDigestEntry[] = [];

  for (const article of candidatesByUrl.values()) {
    const matched = findMatchedSkill(article, targetSkills);
    if (!matched) continue;

    matchedEntries.push({
      source: article.source,
      external_id: article.externalId,
      title: article.title,
      url: article.url,
      tags: article.tags,
      matched_skill_id: matched.id,
    });
  }

  return matchedEntries.slice(0, limit);
}
