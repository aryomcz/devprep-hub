export type NormalizedSkill = {
  canonicalName: string;
  slug: string;
};

const SKILL_ALIASES: Record<string, NormalizedSkill> = {
  c: { canonicalName: "C", slug: "c" },
  cpp: { canonicalName: "C++", slug: "cpp" },
  cplusplus: { canonicalName: "C++", slug: "cpp" },
  csharp: { canonicalName: "C#", slug: "csharp" },
  fsharp: { canonicalName: "F#", slug: "fsharp" },
  dotnet: { canonicalName: ".NET", slug: "dotnet" },
  aspnet: { canonicalName: "ASP.NET", slug: "aspnet" },
  js: { canonicalName: "JavaScript", slug: "javascript" },
  javascript: { canonicalName: "JavaScript", slug: "javascript" },
  ts: { canonicalName: "TypeScript", slug: "typescript" },
  typescript: { canonicalName: "TypeScript", slug: "typescript" },
  py: { canonicalName: "Python", slug: "python" },
  python: { canonicalName: "Python", slug: "python" },
  golang: { canonicalName: "Go", slug: "go" },
  go: { canonicalName: "Go", slug: "go" },
  rust: { canonicalName: "Rust", slug: "rust" },
  java: { canonicalName: "Java", slug: "java" },
  react: { canonicalName: "React", slug: "react" },
  reactjs: { canonicalName: "React", slug: "react" },
  nextjs: { canonicalName: "Next.js", slug: "nextjs" },
  nodejs: { canonicalName: "Node.js", slug: "nodejs" },
  vue: { canonicalName: "Vue.js", slug: "vue" },
  vuejs: { canonicalName: "Vue.js", slug: "vue" },
  angular: { canonicalName: "Angular", slug: "angular" },
  svelte: { canonicalName: "Svelte", slug: "svelte" },
  express: { canonicalName: "Express", slug: "express" },
  expressjs: { canonicalName: "Express", slug: "express" },
  nest: { canonicalName: "NestJS", slug: "nestjs" },
  nestjs: { canonicalName: "NestJS", slug: "nestjs" },
  fastapi: { canonicalName: "FastAPI", slug: "fastapi" },
  django: { canonicalName: "Django", slug: "django" },
  flask: { canonicalName: "Flask", slug: "flask" },
  tailwind: { canonicalName: "Tailwind CSS", slug: "tailwindcss" },
  tailwindcss: { canonicalName: "Tailwind CSS", slug: "tailwindcss" },
  postgres: { canonicalName: "PostgreSQL", slug: "postgresql" },
  postgresql: { canonicalName: "PostgreSQL", slug: "postgresql" },
  pgsql: { canonicalName: "PostgreSQL", slug: "postgresql" },
  mysql: { canonicalName: "MySQL", slug: "mysql" },
  sqlite: { canonicalName: "SQLite", slug: "sqlite" },
  mongo: { canonicalName: "MongoDB", slug: "mongodb" },
  mongodb: { canonicalName: "MongoDB", slug: "mongodb" },
  redis: { canonicalName: "Redis", slug: "redis" },
  supabase: { canonicalName: "Supabase", slug: "supabase" },
  prisma: { canonicalName: "Prisma", slug: "prisma" },
  graphql: { canonicalName: "GraphQL", slug: "graphql" },
  gql: { canonicalName: "GraphQL", slug: "graphql" },
  rest: { canonicalName: "REST API", slug: "rest-api" },
  restapi: { canonicalName: "REST API", slug: "rest-api" },
  restfulapi: { canonicalName: "REST API", slug: "rest-api" },
  docker: { canonicalName: "Docker", slug: "docker" },
  k8s: { canonicalName: "Kubernetes", slug: "kubernetes" },
  kubernetes: { canonicalName: "Kubernetes", slug: "kubernetes" },
  cicd: { canonicalName: "CI/CD", slug: "ci-cd" },
  githubactions: { canonicalName: "GitHub Actions", slug: "github-actions" },
  git: { canonicalName: "Git", slug: "git" },
  linux: { canonicalName: "Linux", slug: "linux" },
  aws: { canonicalName: "AWS", slug: "aws" },
  gcp: { canonicalName: "GCP", slug: "gcp" },
  azure: { canonicalName: "Azure", slug: "azure" },
  html: { canonicalName: "HTML", slug: "html" },
  html5: { canonicalName: "HTML", slug: "html" },
  css: { canonicalName: "CSS", slug: "css" },
  css3: { canonicalName: "CSS", slug: "css" },
  vitest: { canonicalName: "Vitest", slug: "vitest" },
  jest: { canonicalName: "Jest", slug: "jest" },
  playwright: { canonicalName: "Playwright", slug: "playwright" },
  cypress: { canonicalName: "Cypress", slug: "cypress" },
};

function toSlug(input: string): string {
  const symbolNormalized = input
    .toLowerCase()
    .replace(/c\+\+/g, "cpp")
    .replace(/c#/g, "csharp")
    .replace(/f#/g, "fsharp")
    .replace(/\.net\b/g, "dotnet");

  return symbolNormalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeSkill(rawName: string): NormalizedSkill {
  const canonicalName = rawName.trim().replace(/\s+/g, " ");
  if (!canonicalName) {
    return { canonicalName: "", slug: "" };
  }

  const slug = toSlug(canonicalName);
  if (!slug) {
    return { canonicalName: "", slug: "" };
  }

  const compact = slug.replace(/-/g, "");
  return SKILL_ALIASES[slug] ?? SKILL_ALIASES[compact] ?? { canonicalName, slug };
}
