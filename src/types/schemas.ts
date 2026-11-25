import { z } from "zod";

// Canonical Enums (aligned 1:1 with docs/GLOSSARY.md)
export const skillCategorySchema = z.enum([
  "language",
  "framework",
  "concept",
  "tool",
]);
export const skillStatusSchema = z.enum(["gap", "learning", "mastered"]);
export const skillSourceSchema = z.enum(["github", "jd", "manual"]);
export const internshipStatusSchema = z.enum([
  "preparing",
  "applied",
  "interview",
  "offer",
  "rejected",
]);
export const skillPrioritySchema = z.enum(["must_have", "nice_to_have"]);
export const resourceSourceSchema = z.enum([
  "devto",
  "stackoverflow",
  "mdn",
  "wikipedia",
  "youtube",
  "github",
]);
export const trackStatusSchema = z.enum(["active", "completed", "archived"]);
export const moduleTypeSchema = z.enum([
  "capstone_feature",
  "microservice",
  "language_native",
]);
export const moduleStatusSchema = z.enum([
  "locked",
  "in_progress",
  "completed",
]);
export const moduleContentStatusSchema = z.enum([
  "pending",
  "ready",
  "failed",
]);
export const digestSourceSchema = z.enum(["devto", "hackernews"]);
export const quizSourceTypeSchema = z.enum(["note_cloze", "module_drill"]);
export const interviewCardSourceSchema = z.enum([
  "lab_review",
  "skill_gap",
  "manual",
]);
export const confidenceLevelSchema = z.enum(["confused", "partial", "ready"]);

// Internship & Jargon Contracts
export const jargonEntrySchema = z.object({
  term: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  context: z.string().trim().min(1),
});

export const jargonGlossarySchema = z.array(jargonEntrySchema);

export const internshipAnalyzeInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("raw_jd"),
    title: z.string().trim().min(1).max(200),
    company_name: z.string().trim().max(200).optional().default(""),
    industry: z.string().trim().max(120).optional().default(""),
    raw_input: z.string().trim().min(1).max(15000),
  }),
  z.object({
    mode: z.literal("manual_skills"),
    title: z.string().trim().min(1).max(200),
    company_name: z.string().trim().max(200).optional().default(""),
    industry: z.string().trim().max(120).optional().default(""),
    skills: z.array(z.string().trim().min(1)).min(1).max(40),
  }),
  z.object({
    mode: z.literal("role_industry"),
    title: z.string().trim().min(1).max(200),
    company_name: z.string().trim().max(200).optional().default(""),
    role: z.string().trim().min(1).max(120),
    industry: z.string().trim().min(1).max(120),
  }),
]);

// Track Module JSONB Contracts
export const conceptBriefSchema = z.object({
  summary: z.string().trim().min(1),
  analogy: z.string().trim().min(1),
  key_points: z.array(z.string().trim().min(1)).min(1),
});

export const warmupDrillBlankSchema = z.object({
  id: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  hint: z.string().trim().min(1).optional(),
});

export const warmupDrillSchema = z
  .object({
    title: z.string().trim().min(1),
    language: z.string().trim().min(1),
    code_template: z.string().trim().min(1),
    blanks: z.array(warmupDrillBlankSchema).min(1),
  })
  .refine(
    (drill) =>
      drill.blanks.every((blank) =>
        drill.code_template.includes(`___${blank.id}___`),
      ),
    {
      message: "code_template must include ___<id>___ placeholder for every blank",
    },
  );

export const warmupDrillsSchema = z.array(warmupDrillSchema).min(1);

export const handsOnTicketSchema = z.object({
  problem_context: z.string().trim().min(1),
  acceptance_criteria: z.array(z.string().trim().min(1)).min(1),
  progressive_hints: z.object({
    architecture: z.string().trim().min(1),
    pseudocode: z.string().trim().min(1),
    implementation: z.string().trim().min(1),
  }),
});

// Lab Submission Review Contracts
export const aiReviewFeedbackSchema = z.object({
  criteria_met: z.array(z.string().trim().min(1)),
  improvements: z.array(z.string().trim().min(1)),
  summary: z.string().trim().min(1),
});

export const generatedInterviewQuestionsSchema = z
  .array(z.string().trim().min(1))
  .length(2);

export type JargonEntry = z.infer<typeof jargonEntrySchema>;
export type InternshipAnalyzeInput = z.infer<
  typeof internshipAnalyzeInputSchema
>;
export type ConceptBrief = z.infer<typeof conceptBriefSchema>;
export type WarmupDrill = z.infer<typeof warmupDrillSchema>;
export type HandsOnTicket = z.infer<typeof handsOnTicketSchema>;
export type AiReviewFeedback = z.infer<typeof aiReviewFeedbackSchema>;
