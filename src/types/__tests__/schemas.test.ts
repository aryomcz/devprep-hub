import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  aiReviewFeedbackSchema,
  conceptBriefSchema,
  confidenceLevelSchema,
  digestSourceSchema,
  generatedInterviewQuestionsSchema,
  handsOnTicketSchema,
  internshipAnalyzeInputSchema,
  internshipStatusSchema,
  interviewCardSourceSchema,
  jargonEntrySchema,
  moduleContentStatusSchema,
  moduleStatusSchema,
  moduleTypeSchema,
  quizSourceTypeSchema,
  resourceSourceSchema,
  skillCategorySchema,
  skillPrioritySchema,
  skillSourceSchema,
  skillStatusSchema,
  trackStatusSchema,
  warmupDrillSchema,
} from "@/types/schemas";

type TypedSupabaseClient = SupabaseClient<Database>;
const _typeCheckClient: TypedSupabaseClient | null = null;
void _typeCheckClient;

describe("Canonical enum schemas", () => {
  it("accepts exact GLOSSARY enum literals and rejects unknown values", () => {
    expect(skillCategorySchema.parse("language")).toBe("language");
    expect(skillStatusSchema.parse("learning")).toBe("learning");
    expect(skillSourceSchema.parse("github")).toBe("github");
    expect(internshipStatusSchema.parse("preparing")).toBe("preparing");
    expect(skillPrioritySchema.parse("must_have")).toBe("must_have");
    expect(resourceSourceSchema.parse("stackoverflow")).toBe("stackoverflow");
    expect(trackStatusSchema.parse("active")).toBe("active");
    expect(moduleTypeSchema.parse("capstone_feature")).toBe("capstone_feature");
    expect(moduleStatusSchema.parse("in_progress")).toBe("in_progress");
    expect(moduleContentStatusSchema.parse("pending")).toBe("pending");
    expect(digestSourceSchema.parse("hackernews")).toBe("hackernews");
    expect(quizSourceTypeSchema.parse("note_cloze")).toBe("note_cloze");
    expect(interviewCardSourceSchema.parse("lab_review")).toBe("lab_review");
    expect(confidenceLevelSchema.parse("partial")).toBe("partial");

    expect(skillStatusSchema.safeParse("unknown").success).toBe(false);
    expect(moduleContentStatusSchema.safeParse("loading").success).toBe(false);
  });
});

describe("Internship input and jargon contracts", () => {
  it("validates a valid jargon entry", () => {
    const parsed = jargonEntrySchema.parse({
      term: "Idempotency",
      definition: "Repeated identical requests produce the same state.",
      context: "Payment webhook handlers",
    });
    expect(parsed.term).toBe("Idempotency");
  });

  it("supports all 3 internship input modes and rejects raw_input > 15000 chars", () => {
    expect(
      internshipAnalyzeInputSchema.parse({
        mode: "raw_jd",
        title: "Backend Intern",
        raw_input: "Need PostgreSQL and Redis experience",
      }).mode,
    ).toBe("raw_jd");

    expect(
      internshipAnalyzeInputSchema.parse({
        mode: "manual_skills",
        title: "Fullstack Intern",
        skills: ["TypeScript", "PostgreSQL"],
      }).mode,
    ).toBe("manual_skills");

    expect(
      internshipAnalyzeInputSchema.parse({
        mode: "role_industry",
        title: "Platform Intern",
        role: "Backend Engineer",
        industry: "Fintech",
      }).mode,
    ).toBe("role_industry");

    const overLimit = internshipAnalyzeInputSchema.safeParse({
      mode: "raw_jd",
      title: "Backend Intern",
      raw_input: "a".repeat(15001),
    });
    expect(overLimit.success).toBe(false);
  });
});

describe("Track module JSONB & Lab review contracts", () => {
  it("validates ConceptBrief, WarmupDrill with ___BLANK_ slots, and HandsOnTicket", () => {
    const brief = conceptBriefSchema.parse({
      summary: "Connection pooling reuses open Postgres connections.",
      analogy: "Like keeping delivery drivers waiting at the shop.",
      key_points: ["Bounded pool size", "Avoids TCP/TLS handshake overhead"],
    });
    expect(brief.key_points).toHaveLength(2);

    const validDrill = warmupDrillSchema.parse({
      title: "Configure pool limit",
      language: "typescript",
      code_template: "const pool = new Pool({ ___BLANK_1___: 10 });",
      blanks: [{ id: "BLANK_1", answer: "max", hint: "Maximum connections" }],
    });
    expect(validDrill.blanks[0]?.answer).toBe("max");

    const invalidDrill = warmupDrillSchema.safeParse({
      title: "Missing blank placeholder",
      language: "typescript",
      code_template: "const pool = new Pool({ max: 10 });",
      blanks: [{ id: "BLANK_1", answer: "max" }],
    });
    expect(invalidDrill.success).toBe(false);

    const ticket = handsOnTicketSchema.parse({
      problem_context: "Add idempotency key support to POST /orders.",
      acceptance_criteria: [
        "Duplicate key returns existing order with HTTP 200",
        "Missing key returns HTTP 400",
      ],
      progressive_hints: {
        architecture: "Store idempotency_key with unique index per user.",
        pseudocode: "BEGIN; INSERT ... ON CONFLICT DO NOTHING; SELECT ...;",
        implementation: "CREATE UNIQUE INDEX orders_user_idem_idx ...",
      },
    });
    expect(ticket.acceptance_criteria).toHaveLength(2);
  });

  it("validates AiReviewFeedback and 2 generated interview questions", () => {
    const feedback = aiReviewFeedbackSchema.parse({
      criteria_met: ["Checks duplicate key before insert"],
      improvements: ["Wrap check-and-insert in a single transaction"],
      summary: "Solid start, fix race condition under concurrency.",
    });
    expect(feedback.criteria_met).toHaveLength(1);

    const qs = generatedInterviewQuestionsSchema.parse([
      "Why is SELECT-then-INSERT unsafe for idempotency?",
      "How long would you retain idempotency keys?",
    ]);
    expect(qs).toHaveLength(2);

    expect(
      generatedInterviewQuestionsSchema.safeParse(["Only one question"]).success,
    ).toBe(false);
  });
});
