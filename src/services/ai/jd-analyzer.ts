import { z } from "zod";
import { generateStructuredJson } from "@/lib/gemini";
import { normalizeSkill } from "@/lib/skill-normalizer";
import type { SkillCategory, SkillPriority } from "@/types/database";
import {
  internshipAnalyzeInputSchema,
  jargonGlossarySchema,
  skillCategorySchema,
  skillPrioritySchema,
  type InternshipAnalyzeInput,
  type JargonEntry,
} from "@/types/schemas";

export const MAX_RAW_JD_CHARS = 15_000;

export type ExistingSkillRef = {
  slug: string;
  name: string;
  category?: SkillCategory;
};

export type ExtractedInternshipSkill = {
  name: string;
  slug: string;
  category: SkillCategory;
  priority: SkillPriority;
};

export type InternshipAnalysisResult = {
  title: string;
  company_name: string;
  industry: string;
  raw_input: string;
  skills: ExtractedInternshipSkill[];
  jargon_glossary: JargonEntry[];
};

const CATEGORY_MAP: Record<string, SkillCategory> = {
  language: "language",
  framework: "framework",
  concept: "concept",
  tool: "tool",
  library: "framework",
  runtime: "framework",
  database: "tool",
  db: "tool",
  platform: "tool",
  cloud: "tool",
  service: "tool",
  devops: "tool",
  architecture: "concept",
  methodology: "concept",
  pattern: "concept",
  protocol: "concept",
};

const rawAiAnalysisSchema = z.object({
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        category: z
          .string()
          .transform((val) => CATEGORY_MAP[val.trim().toLowerCase()] ?? "tool")
          .pipe(skillCategorySchema),
        priority: z
          .string()
          .transform((val) =>
            val.trim().toLowerCase() === "nice_to_have"
              ? "nice_to_have"
              : "must_have",
          )
          .pipe(skillPrioritySchema),
      }),
    )
    .min(1),
  jargon_glossary: jargonGlossarySchema,
});

export type RawAiAnalysisOutput = z.infer<typeof rawAiAnalysisSchema>;

export type GenerateAnalysisFn = (
  prompt: string,
) => Promise<RawAiAnalysisOutput>;

const SOFT_SKILL_SLUGS = new Set([
  "communication",
  "good-communication",
  "teamwork",
  "team-player",
  "leadership",
  "time-management",
  "problem-solving",
  "fast-learner",
  "adaptability",
  "collaboration",
  "work-ethic",
  "critical-thinking",
  "public-speaking",
  "interpersonal-skills",
  "attention-to-detail",
  "agile-mindset",
  "self-motivated",
  "english",
  "english-proficiency",
  "bahasa-inggris",
]);

function buildRawInputSummary(input: InternshipAnalyzeInput): string {
  if (input.mode === "raw_jd") {
    return input.raw_input;
  }
  if (input.mode === "manual_skills") {
    return `Manual skills: ${input.skills.join(", ")}`;
  }
  return `Role: ${input.role} | Industry: ${input.industry}`;
}

function buildAnalysisPrompt(
  input: InternshipAnalyzeInput,
  existingSkills: ExistingSkillRef[],
): string {
  const existingLines =
    existingSkills.length > 0
      ? existingSkills
          .map((skill) => `- ${skill.name} (slug: ${skill.slug})`)
          .join("\n")
      : "- (belum ada skill eksisting)";

  const sourceBlock =
    input.mode === "raw_jd"
      ? `MODE: RAW JOB DESCRIPTION\nJudul: ${input.title}\nPerusahaan: ${input.company_name || "-"}\nIndustri: ${input.industry || "-"}\nTeks JD:\n"""\n${input.raw_input}\n"""`
      : input.mode === "manual_skills"
        ? `MODE: MANUAL SKILLS\nJudul: ${input.title}\nPerusahaan: ${input.company_name || "-"}\nIndustri: ${input.industry || "-"}\nDaftar Skill Target:\n${input.skills.map((s) => `- ${s}`).join("\n")}`
        : `MODE: ROLE & INDUSTRY\nJudul: ${input.title}\nPerusahaan: ${input.company_name || "-"}\nPeran: ${input.role}\nIndustri: ${input.industry}`;

  return [
    "Anda adalah analis teknik perangkat lunak untuk mahasiswa/engineer pencari magang.",
    "Tugas: Ekstrak HARD ENGINEERING SKILLS dan JARGON TEKNIS/INDUSTRI dalam format JSON.",
    "",
    "ATURAN KETAT:",
    "1. HANYA ekstrak hard engineering skills dan isi category HANYA dengan salah satu dari 4 nilai persis ini: language | framework | concept | tool (database/Redis/MongoDB/PostgreSQL -> tool; library/runtime -> framework; arsitektur/SOLID/microservices/unit test -> concept). JANGAN gunakan nilai lain seperti database atau platform.",
    "2. DILARANG mengekstrak soft skills atau atribut HR (seperti communication, teamwork, team player, leadership, problem solving, time management, fast learner, adaptability, English).",
    "3. Gunakan nama skill eksisting di bawah ini apa adanya jika cocok secara semantik (Layer 2 deduplication):",
    existingLines,
    "4. Tentukan priority: must_have (wajib/inti) atau nice_to_have (nilai tambah).",
    "5. Untuk jargon_glossary, pilih istilah teknis/domain spesifik beserta definition ringkas dan context di lowongan (dalam Bahasa Indonesia yang jelas).",
    '6. Kembalikan JSON persis sesuai struktur: {"skills":[{"name":"string","category":"language|framework|concept|tool","priority":"must_have|nice_to_have"}],"jargon_glossary":[{"term":"string","definition":"string","context":"string"}]}.',
    "",
    sourceBlock,
  ].join("\n");
}

function defaultGenerateFn(prompt: string): Promise<RawAiAnalysisOutput> {
  return generateStructuredJson({
    prompt,
    schema: rawAiAnalysisSchema,
  });
}

export async function analyzeInternshipInput(
  input: InternshipAnalyzeInput,
  existingSkills: ExistingSkillRef[] = [],
  generateFn: GenerateAnalysisFn = defaultGenerateFn,
): Promise<InternshipAnalysisResult> {
  if (input.mode === "raw_jd" && input.raw_input.length > MAX_RAW_JD_CHARS) {
    throw new Error(
      `Teks JD melebihi batas maksimum ${MAX_RAW_JD_CHARS.toLocaleString("id-ID")} karakter.`,
    );
  }

  const validatedInput = internshipAnalyzeInputSchema.parse(input);
  const prompt = buildAnalysisPrompt(validatedInput, existingSkills);
  const aiOutput = rawAiAnalysisSchema.parse(await generateFn(prompt));

  const existingBySlug = new Map<string, ExistingSkillRef>();
  for (const existing of existingSkills) {
    existingBySlug.set(existing.slug, existing);
    const normalized = normalizeSkill(existing.name);
    if (normalized.slug && !existingBySlug.has(normalized.slug)) {
      existingBySlug.set(normalized.slug, existing);
    }
  }

  const dedupedSkills = new Map<string, ExtractedInternshipSkill>();

  for (const rawSkill of aiOutput.skills) {
    const normalized = normalizeSkill(rawSkill.name);
    if (!normalized.slug || SOFT_SKILL_SLUGS.has(normalized.slug)) {
      continue;
    }

    const matchedExisting = existingBySlug.get(normalized.slug);
    const canonicalSlug = matchedExisting?.slug ?? normalized.slug;
    const canonicalName = matchedExisting?.name ?? normalized.canonicalName;

    const current = dedupedSkills.get(canonicalSlug);
    if (!current) {
      dedupedSkills.set(canonicalSlug, {
        name: canonicalName,
        slug: canonicalSlug,
        category: rawSkill.category,
        priority: rawSkill.priority,
      });
      continue;
    }

    // must_have always wins over nice_to_have when aliases collapse onto one slug.
    const mergedPriority: SkillPriority =
      current.priority === "must_have" || rawSkill.priority === "must_have"
        ? "must_have"
        : "nice_to_have";

    dedupedSkills.set(canonicalSlug, {
      ...current,
      priority: mergedPriority,
      category:
        rawSkill.priority === "must_have" && current.priority !== "must_have"
          ? rawSkill.category
          : current.category,
    });
  }

  return {
    title: validatedInput.title,
    company_name: validatedInput.company_name,
    industry: validatedInput.industry,
    raw_input: buildRawInputSummary(validatedInput),
    skills: Array.from(dedupedSkills.values()),
    jargon_glossary: aiOutput.jargon_glossary,
  };
}
