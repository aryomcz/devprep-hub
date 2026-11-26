import {
  sanitizeCodeOrDiff,
  type SanitizedDiffResult,
} from "@/lib/diff-sanitizer";
import { normalizeSkill } from "@/lib/skill-normalizer";
import type { SkillCategory } from "@/types/database";

const GITHUB_API_BASE = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 4000;
const DEFAULT_MAX_REPOS = 20;
const MAX_PACKAGE_JSON_CHECKS = 10;

export class GithubSyncError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GithubSyncError";
    this.status = status;
  }
}

export type ExtractedGithubSkill = {
  canonicalName: string;
  slug: string;
  category: SkillCategory;
};

export type GithubSyncOptions = {
  fetchFn?: typeof fetch;
  token?: string;
  maxRepos?: number;
};

type GithubRepo = {
  name: string;
  full_name: string;
  fork: boolean;
  language: string | null;
  topics?: string[];
};

const PACKAGE_TO_SKILL: Record<string, string> = {
  next: "Next.js",
  react: "React",
  "react-dom": "React",
  typescript: "TypeScript",
  tailwindcss: "Tailwind CSS",
  "@tailwindcss/postcss": "Tailwind CSS",
  "@tailwindcss/turbopack": "Tailwind CSS",
  "@supabase/supabase-js": "Supabase",
  "@supabase/ssr": "Supabase",
  prisma: "Prisma",
  "@prisma/client": "Prisma",
  zod: "Zod",
  vitest: "Vitest",
  jest: "Jest",
  playwright: "Playwright",
  "@playwright/test": "Playwright",
  cypress: "Cypress",
  express: "Express",
  "@nestjs/core": "NestJS",
  vue: "Vue.js",
  svelte: "Svelte",
  "@angular/core": "Angular",
  pg: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql2: "MySQL",
  mongoose: "MongoDB",
  mongodb: "MongoDB",
  redis: "Redis",
  ioredis: "Redis",
  graphql: "GraphQL",
};

const LANGUAGE_SLUGS = new Set([
  "c",
  "cpp",
  "csharp",
  "fsharp",
  "javascript",
  "typescript",
  "python",
  "go",
  "rust",
  "java",
  "html",
  "css",
  "sql",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "dart",
  "shell",
  "bash",
  "powershell",
]);

const FRAMEWORK_SLUGS = new Set([
  "react",
  "nextjs",
  "nodejs",
  "vue",
  "angular",
  "svelte",
  "express",
  "nestjs",
  "fastapi",
  "django",
  "flask",
  "tailwindcss",
  "dotnet",
  "aspnet",
  "laravel",
  "spring",
  "flutter",
]);

const CONCEPT_SLUGS = new Set([
  "rest-api",
  "graphql",
  "ci-cd",
  "microservices",
  "websockets",
  "oauth",
  "ssr",
  "testing",
  "tdd",
]);

function inferCategory(slug: string, fromRepoLanguage: boolean): SkillCategory {
  if (LANGUAGE_SLUGS.has(slug)) return "language";
  if (FRAMEWORK_SLUGS.has(slug)) return "framework";
  if (CONCEPT_SLUGS.has(slug)) return "concept";
  return fromRepoLanguage ? "language" : "tool";
}

function buildGithubHeaders(
  token?: string,
  accept = "application/vnd.github+json",
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "dev-prep-hub",
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

async function fetchPackageJsonDeps(
  repoFullName: string,
  fetchFn: typeof fetch,
  headers: HeadersInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<string[]> {
  const res = await fetchFn(
    `${GITHUB_API_BASE}/repos/${repoFullName}/contents/package.json`,
    {
      headers,
      signal: AbortSignal.timeout(Math.max(50, timeoutMs)),
    },
  );
  if (!res.ok) return [];

  const payload = (await res.json()) as {
    content?: string;
    encoding?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = payload;

  if (typeof payload.content === "string") {
    const decoded = Buffer.from(
      payload.content.replace(/\n/g, ""),
      "base64",
    ).toString("utf8");
    pkg = JSON.parse(decoded) as typeof pkg;
  }

  const allDeps = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];

  const mapped: string[] = [];
  for (const dep of allDeps) {
    const skillName = PACKAGE_TO_SKILL[dep.toLowerCase()];
    if (skillName) {
      mapped.push(skillName);
    }
  }
  return mapped;
}

export async function fetchUserGithubSkills(
  username: string,
  options: GithubSyncOptions = {},
): Promise<{ skills: ExtractedGithubSkill[]; scannedRepos: number }> {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    throw new GithubSyncError("Username GitHub wajib diisi.", 400);
  }

  const fetchFn = options.fetchFn ?? fetch;
  const maxRepos = options.maxRepos ?? DEFAULT_MAX_REPOS;
  const headers = buildGithubHeaders(options.token);
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;

  const reposRes = await fetchFn(
    `${GITHUB_API_BASE}/users/${encodeURIComponent(trimmedUsername)}/repos?type=owner&sort=updated&per_page=40`,
    {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (reposRes.status === 404) {
    throw new GithubSyncError("Akun GitHub tidak ditemukan.", 404);
  }
  if (reposRes.status === 403 || reposRes.status === 429) {
    throw new GithubSyncError(
      "Rate limit GitHub API tercapai. Coba lagi nanti atau atur GITHUB_TOKEN.",
      429,
    );
  }
  if (!reposRes.ok) {
    throw new GithubSyncError(
      "Gagal mengambil daftar repositori GitHub.",
      reposRes.status,
    );
  }

  const rawRepos = (await reposRes.json()) as GithubRepo[];
  const ownedRepos = rawRepos
    .filter((repo) => !repo.fork)
    .slice(0, maxRepos);

  const skillMap = new Map<string, ExtractedGithubSkill>();
  const addCandidate = (rawName: string, fromRepoLanguage: boolean) => {
    const normalized = normalizeSkill(rawName);
    if (!normalized.slug || skillMap.has(normalized.slug)) return;
    skillMap.set(normalized.slug, {
      canonicalName: normalized.canonicalName,
      slug: normalized.slug,
      category: inferCategory(normalized.slug, fromRepoLanguage),
    });
  };

  for (const repo of ownedRepos) {
    if (repo.language) {
      addCandidate(repo.language, true);
    }
    for (const topic of repo.topics ?? []) {
      addCandidate(topic, false);
    }
  }

  const jsTsCandidates = ownedRepos
    .filter(
      (repo) =>
        repo.language === "TypeScript" ||
        repo.language === "JavaScript" ||
        repo.language === null,
    )
    .slice(0, MAX_PACKAGE_JSON_CHECKS);

  const remainingMs = deadline - Date.now();
  const pkgResults =
    remainingMs > 0
      ? await Promise.allSettled(
          jsTsCandidates.map((repo) =>
            fetchPackageJsonDeps(repo.full_name, fetchFn, headers, remainingMs),
          ),
        )
      : [];

  for (const result of pkgResults) {
    if (result.status !== "fulfilled") continue;
    for (const skillName of result.value) {
      addCandidate(skillName, false);
    }
  }

  return {
    skills: Array.from(skillMap.values()),
    scannedRepos: ownedRepos.length,
  };
}

const GITHUB_COMMIT_URL_REGEX =
  /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/commit\/([0-9a-fA-F]{7,40})(?:\.diff|\.patch)?(?:[/?#].*)?$/;

export async function fetchSanitizedCommitDiff(
  commitUrl: string,
  options: Pick<GithubSyncOptions, "fetchFn" | "token"> = {},
): Promise<SanitizedDiffResult> {
  const match = GITHUB_COMMIT_URL_REGEX.exec(commitUrl.trim());
  if (!match) {
    throw new GithubSyncError(
      "URL commit GitHub tidak valid. Gunakan format https://github.com/<owner>/<repo>/commit/<sha>.",
      400,
    );
  }

  const [, owner, repo, sha] = match;
  const fetchFn = options.fetchFn ?? fetch;
  const headers = buildGithubHeaders(options.token, "application/vnd.github.v3.diff");

  const res = await fetchFn(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`,
    {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (res.status === 404) {
    throw new GithubSyncError("Commit GitHub tidak ditemukan atau privat.", 404);
  }
  if (res.status === 403 || res.status === 429) {
    throw new GithubSyncError(
      "Rate limit GitHub API tercapai saat mengambil diff commit.",
      429,
    );
  }
  if (!res.ok) {
    throw new GithubSyncError(
      "Gagal mengambil diff commit dari GitHub.",
      res.status,
    );
  }

  const rawDiff = await res.text();
  return sanitizeCodeOrDiff(rawDiff);
}
