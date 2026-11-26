import { z } from "zod";
import { sanitizeCodeOrDiff } from "@/lib/diff-sanitizer";
import { generateStructuredJson } from "@/lib/gemini";
import {
  aiReviewFeedbackSchema,
  generatedInterviewQuestionsSchema,
  type AiReviewFeedback,
} from "@/types/schemas";

export type LabReviewInput = {
  skillName: string;
  targetLanguage: string;
  objective: string;
  acceptanceCriteria: string[];
  submittedCodeOrDiff: string;
  skippedFiles?: string[];
};

export const labReviewResultSchema = z.object({
  passed: z.boolean(),
  feedback: aiReviewFeedbackSchema,
  interview_questions: generatedInterviewQuestionsSchema,
});

export type LabReviewResult = z.infer<typeof labReviewResultSchema>;

export type GenerateLabReviewFn = (prompt: string) => Promise<LabReviewResult>;

function buildReviewPrompt(
  input: LabReviewInput,
  sanitizedCode: string,
): string {
  const criteriaLines =
    input.acceptanceCriteria.length > 0
      ? input.acceptanceCriteria
          .map((item, idx) => `${idx + 1}. ${item}`)
          .join("\n")
      : "1. Kode mengimplementasikan objektif modul dengan bersih dan aman.";

  return [
    "Anda adalah Staff Engineer & Pewawancara Teknikal yang mengevaluasi Lab Submission untuk proyek Capstone.",
    "",
    `Skill Fokus: ${input.skillName} (${input.targetLanguage})`,
    `Objektif Modul: ${input.objective}`,
    "Acceptance Criteria yang wajib diperiksa:",
    criteriaLines,
    input.skippedFiles && input.skippedFiles.length > 0
      ? `File lockfile/binary yang dilewati otomatis: ${input.skippedFiles.join(", ")}`
      : "",
    "",
    "Kode / Diff Kiriman Pengguna (sudah disanitasi maks. 12.000 karakter):",
    "```",
    sanitizedCode,
    "```",
    "",
    "ATURAN KETAT OUTPUT JSON:",
    "1. passed (boolean): true HANYA jika implementasi inti memenuhi mayoritas/seluruh Acceptance Criteria secara substansial; false jika masih stub, salah logika, atau belum memenuhi kriteria utama.",
    "2. feedback: { criteria_met: string[], improvements: string[], summary: string } dalam Bahasa Indonesia yang konstruktif.",
    "3. interview_questions: TEPAT 2 pertanyaan wawancara teknis spesifik yang menggali keputusan desain, edge case, atau trade-off dari kode yang dikirim pengguna.",
    '4. Kembalikan JSON persis sesuai struktur: {"passed":true,"feedback":{"criteria_met":["string"],"improvements":["string"],"summary":"string"},"interview_questions":["pertanyaan 1","pertanyaan 2"]}.',
  ]
    .filter(Boolean)
    .join("\n");
}

function defaultGenerateLabReview(prompt: string): Promise<LabReviewResult> {
  return generateStructuredJson({
    prompt,
    schema: labReviewResultSchema,
  });
}

export async function reviewLabSubmission(
  input: LabReviewInput,
  generateFn: GenerateLabReviewFn = defaultGenerateLabReview,
): Promise<LabReviewResult> {
  const sanitized = sanitizeCodeOrDiff(input.submittedCodeOrDiff);
  if (!sanitized.sanitizedText.trim()) {
    throw new Error(
      "Kode atau diff commit kosong setelah sanitasi. Sertakan perubahan kode sumber untuk direview.",
    );
  }

  const prompt = buildReviewPrompt(
    {
      ...input,
      skippedFiles:
        input.skippedFiles && input.skippedFiles.length > 0
          ? input.skippedFiles
          : sanitized.skippedFiles,
    },
    sanitized.sanitizedText,
  );

  const raw = await generateFn(prompt);
  return labReviewResultSchema.parse(raw);
}

export type { AiReviewFeedback };
