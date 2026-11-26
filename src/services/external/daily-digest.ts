import { fetchDevToResources } from "@/services/external/devto";
import { fetchHackerNewsTopStories } from "@/services/external/hackernews";
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
  matched_skill_id: string | null;
};

export type DigestAdapters = {
  fetchDevToByTag?: (tag: string) => Promise<DigestCandidateArticle[]>;
  fetchHackerNews?: () => Promise<DigestCandidateArticle[]>;
};

function findMatchedSkill(
  article: DigestCandidateArticle,
  targetSkills: DigestSkillTarget[],
): DigestSkillTarget | null {
  const titleLower = article.title.toLowerCase();
  const tagSet = new Set(article.tags.map((t) => t.toLowerCase()));

  for (const skill of targetSkills) {
    const slugLower = skill.slug.toLowerCase();
    const compactSlug = slugLower.replace(/-/g, "");
    const nameLower = skill.name.toLowerCase();

    if (
      tagSet.has(slugLower) ||
      tagSet.has(compactSlug) ||
      titleLower.includes(nameLower) ||
      titleLower.includes(slugLower)
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
  const targetSkills = skills.filter(
    (skill) => skill.status === "gap" || skill.status === "learning",
  );
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
      if (!article.url || candidatesByUrl.has(article.url)) continue;
      candidatesByUrl.set(article.url, article);
    }
  }

  const matchedEntries: CuratedDigestEntry[] = [];
  const unmatchedFallback: CuratedDigestEntry[] = [];

  for (const article of candidatesByUrl.values()) {
    const matched = findMatchedSkill(article, targetSkills);
    const entry: CuratedDigestEntry = {
      source: article.source,
      external_id: article.externalId,
      title: article.title,
      url: article.url,
      tags: article.tags,
      matched_skill_id: matched?.id ?? null,
    };

    if (matched) {
      matchedEntries.push(entry);
    } else {
      unmatchedFallback.push(entry);
    }
  }

  return [...matchedEntries, ...unmatchedFallback].slice(0, limit);
}
