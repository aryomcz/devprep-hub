import { z } from "zod";
import { generateStructuredJson } from "@/lib/gemini";
import type { SourcedResourceItem } from "@/services/external/hybrid-sourcing";
import type { ModuleType, SkillCategory } from "@/types/database";
import {
  conceptBriefSchema,
  handsOnTicketSchema,
  warmupDrillsSchema,
  type ConceptBrief,
  type HandsOnTicket,
  type WarmupDrill,
} from "@/types/schemas";

export type ModuleGenerationContext = {
  capstoneTitle: string;
  capstoneDescription: string;
  primaryStack: string;
  architectureOverview: string;
  skillName: string;
  skillCategory: SkillCategory;
  moduleType: ModuleType;
  targetLanguage: string;
  objective: string;
  curatedResources: SourcedResourceItem[];
};

export const generatedModuleContentSchema = z.object({
  concept_brief: conceptBriefSchema,
  warmup_drills: warmupDrillsSchema.max(5),
  hands_on_ticket: handsOnTicketSchema,
});

export type GeneratedModuleContent = z.infer<
  typeof generatedModuleContentSchema
>;

export type GenerateModuleContentFn = (
  prompt: string,
) => Promise<GeneratedModuleContent>;

function buildModulePrompt(context: ModuleGenerationContext): string {
  const resourceLines =
    context.curatedResources.length > 0
      ? context.curatedResources
          .slice(0, 6)
          .map(
            (res, idx) =>
              `${idx + 1}. [${res.source}] ${res.title} (${res.url}) — ${res.summary || "-"}`,
          )
          .join("\n")
      : "- (tidak ada referensi eksternal yang tersedia; gunakan pengetahuan fundamental resmi)";

  return [
    "Anda adalah Senior Software Engineer & Mentor Teknik yang menyusun isi lengkap 1 modul praktikum dalam proyek ONE-APP CAPSTONE.",
    "",
    `Capstone: ${context.capstoneTitle}`,
    `Deskripsi Capstone: ${context.capstoneDescription}`,
    `Primary Stack: ${context.primaryStack}`,
    `Arsitektur: ${context.architectureOverview}`,
    "",
    `Modul Skill: ${context.skillName} (${context.skillCategory})`,
    `Tipe Modul: ${context.moduleType}`,
    `Bahasa / Stack Target: ${context.targetLanguage}`,
    `Objektif Modul: ${context.objective}`,
    "",
    "Referensi Terkurasi (CuratedResource):",
    resourceLines,
    "",
    "ATURAN KETAT OUTPUT JSON:",
    "1. concept_brief: summary ringkas namun padat, analogy yang mudah dipahami, dan minimal 3 key_points praktis (Bahasa Indonesia yang jelas).",
    "2. warmup_drills: buat 3 sampai 5 soal fill-in-the-blank singkat. Setiap item wajib memiliki title, language, code_template, dan blanks ([{ id, answer, hint }]). Setiap blank.id (mis. 'BLANK_1', 'BLANK_2') WAJIB muncul persis sebagai ___BLANK_1___, ___BLANK_2___ di dalam code_template.",
    "3. hands_on_ticket: problem_context yang terhubung langsung ke fitur di One-App Capstone di atas, acceptance_criteria minimal 3 poin terukur, serta progressive_hints dengan 3 tingkat lengkap: architecture, pseudocode, dan implementation.",
    '4. Kembalikan JSON persis sesuai struktur: {"concept_brief":{"summary":"string","analogy":"string","key_points":["string"]},"warmup_drills":[{"title":"string","language":"string","code_template":"string","blanks":[{"id":"BLANK_1","answer":"string","hint":"string"}]}],"hands_on_ticket":{"problem_context":"string","acceptance_criteria":["string"],"progressive_hints":{"architecture":"string","pseudocode":"string","implementation":"string"}}}.',
  ].join("\n");
}

function defaultGenerateModuleContent(
  prompt: string,
): Promise<GeneratedModuleContent> {
  return generateStructuredJson({
    prompt,
    schema: generatedModuleContentSchema,
  });
}

export async function generateModuleContent(
  context: ModuleGenerationContext,
  generateFn: GenerateModuleContentFn = defaultGenerateModuleContent,
): Promise<GeneratedModuleContent> {
  const prompt = buildModulePrompt(context);
  const raw = await generateFn(prompt);
  return generatedModuleContentSchema.parse(raw);
}

export type { ConceptBrief, WarmupDrill, HandsOnTicket };
