import { z } from "zod";
import { generateStructuredJson } from "@/lib/gemini";
import { normalizeSkill } from "@/lib/skill-normalizer";
import type {
  LanguageSkillMode,
  ModuleType,
  SkillCategory,
  SkillPriority,
  SkillStatus,
} from "@/types/database";
import { moduleTypeSchema } from "@/types/schemas";

export type { LanguageSkillMode };

export type TrackSkillCandidate = {
  id: string;
  name: string;
  slug: string;
  category: SkillCategory;
  status: SkillStatus;
  priority?: SkillPriority;
};

export type TrackBlueprintInput = {
  internshipTitle?: string;
  companyName?: string;
  industry?: string;
  skills: TrackSkillCandidate[];
  languageMode?: LanguageSkillMode;
};

export type TrackModuleSkeleton = {
  skill_id: string;
  order_index: number;
  module_type: ModuleType;
  target_language: string;
  objective: string;
};

export type TrackBlueprintResult = {
  capstone_title: string;
  capstone_description: string;
  primary_stack: string;
  architecture_overview: string;
  modules: TrackModuleSkeleton[];
};

const rawBlueprintSchema = z.object({
  capstone_title: z.string().trim().min(1),
  capstone_description: z.string().trim().min(1),
  primary_stack: z.string().trim().min(1),
  architecture_overview: z.string().trim().min(1),
  modules: z
    .array(
      z.object({
        skill_slug: z.string().trim().min(1),
        order_index: z.number().int().min(0),
        module_type: z
          .string()
          .transform((val) => {
            const normalized = val.trim().toLowerCase();
            if (normalized === "microservice") return "microservice";
            if (normalized === "language_native") return "language_native";
            return "capstone_feature";
          })
          .pipe(moduleTypeSchema),
        target_language: z.string().trim().min(1),
        objective: z.string().trim().min(1),
      }),
    )
    .min(1),
});

export type RawTrackBlueprintOutput = z.infer<typeof rawBlueprintSchema>;

export type GenerateBlueprintFn = (
  prompt: string,
) => Promise<RawTrackBlueprintOutput>;

const STATUS_WEIGHT: Record<SkillStatus, number> = {
  gap: 0,
  learning: 1,
  mastered: 2,
};

function prioritizeSkills(skills: TrackSkillCandidate[]): TrackSkillCandidate[] {
  return [...skills]
    .sort((a, b) => {
      const aMust = a.priority === "must_have" ? 0 : 1;
      const bMust = b.priority === "must_have" ? 0 : 1;
      if (aMust !== bMust) return aMust - bMust;
      return STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status];
    })
    .slice(0, 10);
}

function classifyModuleType(
  skill: TrackSkillCandidate,
  primaryStack: string,
  languageMode: LanguageSkillMode,
): ModuleType {
  if (skill.category !== "language") {
    return "capstone_feature";
  }

  const stackTokenSlugs = new Set(
    primaryStack
      .split(/[\s+,/|&()]+/)
      .map((token) => normalizeSkill(token).slug)
      .filter(Boolean),
  );

  return stackTokenSlugs.has(skill.slug.toLowerCase())
    ? "capstone_feature"
    : languageMode;
}

function buildBlueprintPrompt(
  input: TrackBlueprintInput,
  selectedSkills: TrackSkillCandidate[],
  languageMode: LanguageSkillMode,
): string {
  const skillLines = selectedSkills
    .map(
      (skill) =>
        `- slug: "${skill.slug}", name: "${skill.name}", category: "${skill.category}", status: "${skill.status}", priority: "${skill.priority ?? "must_have"}"`,
    )
    .join("\n");

  const contextHeader = input.internshipTitle
    ? `Target Magang: ${input.internshipTitle} (${input.companyName || "Perusahaan Umum"} | Industri: ${input.industry || "-"})`
    : "Target Belajar: Kurikulum Skill Kustom";

  return [
    "Anda adalah Staff Software Architect yang merancang kurikulum praktikum berbasis ONE-APP CAPSTONE.",
    "Tugas: Buat BLUEPRINT LINTAS MODUL (Tahap 1 saja — JANGAN isi detail soal, materi, atau hint).",
    "",
    contextHeader,
    `Mode bahasa pemrograman sekunder (non-primary stack): ${languageMode}`,
    "Daftar Skill Target (wajib tercakup tepat 1 modul per skill):",
    skillLines,
    "",
    "ATURAN KETAT:",
    "1. Rancang SATU aplikasi utama (One-App Capstone) yang kohesif dan realistis untuk portofolio magang.",
    "2. Urutkan modul dari fondasi arsitektur/bahasa inti ke fitur/layanan lanjutan (order_index mulai dari 1).",
    "3. Untuk category framework/concept/tool -> module_type wajib 'capstone_feature'. Untuk language di luar primary_stack -> gunakan '" +
      languageMode +
      "'.",
    '4. Kembalikan JSON persis sesuai struktur: {"capstone_title":"string","capstone_description":"string","primary_stack":"string","architecture_overview":"string","modules":[{"skill_slug":"string","order_index":1,"module_type":"capstone_feature|microservice|language_native","target_language":"string","objective":"string"}]}.',
  ].join("\n");
}

function defaultGenerateBlueprint(
  prompt: string,
): Promise<RawTrackBlueprintOutput> {
  return generateStructuredJson({
    prompt,
    schema: rawBlueprintSchema,
  });
}

export async function generateTrackBlueprint(
  input: TrackBlueprintInput,
  generateFn: GenerateBlueprintFn = defaultGenerateBlueprint,
): Promise<TrackBlueprintResult> {
  if (input.skills.length === 0) {
    throw new Error("Pilih minimal 1 skill target untuk membuat Learning Track.");
  }

  const languageMode: LanguageSkillMode = input.languageMode ?? "microservice";
  const selectedSkills = prioritizeSkills(input.skills);
  const prompt = buildBlueprintPrompt(input, selectedSkills, languageMode);
  const aiOutput = rawBlueprintSchema.parse(await generateFn(prompt));

  const skillBySlug = new Map<string, TrackSkillCandidate>();
  for (const skill of selectedSkills) {
    skillBySlug.set(skill.slug, skill);
    const normalized = normalizeSkill(skill.name);
    if (normalized.slug && !skillBySlug.has(normalized.slug)) {
      skillBySlug.set(normalized.slug, skill);
    }
  }

  const resolvedBySkillId = new Map<
    string,
    { aiOrder: number; skeleton: Omit<TrackModuleSkeleton, "order_index"> }
  >();

  for (const mod of aiOutput.modules) {
    const normalized = normalizeSkill(mod.skill_slug);
    const skill =
      skillBySlug.get(mod.skill_slug.toLowerCase()) ??
      (normalized.slug ? skillBySlug.get(normalized.slug) : undefined);

    if (!skill || resolvedBySkillId.has(skill.id)) {
      continue;
    }

    resolvedBySkillId.set(skill.id, {
      aiOrder: mod.order_index,
      skeleton: {
        skill_id: skill.id,
        module_type: classifyModuleType(
          skill,
          aiOutput.primary_stack,
          languageMode,
        ),
        target_language:
          skill.category === "language" ? skill.name : mod.target_language,
        objective: mod.objective,
      },
    });
  }

  // Ensure every selected skill receives a skeleton module even if omitted by the LLM.
  let fallbackOrder = aiOutput.modules.length + 1;
  for (const skill of selectedSkills) {
    if (resolvedBySkillId.has(skill.id)) continue;
    resolvedBySkillId.set(skill.id, {
      aiOrder: fallbackOrder++,
      skeleton: {
        skill_id: skill.id,
        module_type: classifyModuleType(
          skill,
          aiOutput.primary_stack,
          languageMode,
        ),
        target_language:
          skill.category === "language" ? skill.name : aiOutput.primary_stack,
        objective: `Implementasi modul ${skill.name} pada ${aiOutput.capstone_title}.`,
      },
    });
  }

  const orderedModules: TrackModuleSkeleton[] = Array.from(
    resolvedBySkillId.values(),
  )
    .sort((a, b) => a.aiOrder - b.aiOrder)
    .map((entry, idx) => ({
      ...entry.skeleton,
      order_index: idx + 1,
    }));

  return {
    capstone_title: aiOutput.capstone_title,
    capstone_description: aiOutput.capstone_description,
    primary_stack: aiOutput.primary_stack,
    architecture_overview: aiOutput.architecture_overview,
    modules: orderedModules,
  };
}
