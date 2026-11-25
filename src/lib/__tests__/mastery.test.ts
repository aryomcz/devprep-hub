import { describe, expect, it } from "vitest";
import {
  calculateMasteryBreakdown,
  calculateReadinessMeter,
  deriveSkillStatus,
  type MasteryInput,
  type ReadinessItem,
} from "@/lib/mastery";
import type { SkillStatus } from "@/types/database";

describe("deriveSkillStatus", () => {
  it.each<[number, SkillStatus]>([
    [0, "gap"],
    [29, "gap"],
    [30, "learning"],
    [79, "learning"],
    [80, "mastered"],
    [100, "mastered"],
  ])("maps score %i -> %s", (score, expected) => {
    expect(deriveSkillStatus(score)).toBe(expected);
  });
});

describe("calculateMasteryBreakdown", () => {
  const cases: Array<{
    name: string;
    input: MasteryInput;
    expectedScore: number;
    expectedStatus: SkillStatus;
    expectedCapped: boolean;
  }> = [
    {
      name: "0 signals with github source starts at baseline 40",
      input: {
        source: "github",
        quizScores: [],
        labPassed: false,
        labSubmitted: false,
        latestConfidence: null,
      },
      expectedScore: 40,
      expectedStatus: "learning",
      expectedCapped: false,
    },
    {
      name: "0 signals with jd or manual source starts at 0",
      input: {
        source: "jd",
        quizScores: [],
        labPassed: false,
        labSubmitted: false,
        latestConfidence: null,
      },
      expectedScore: 0,
      expectedStatus: "gap",
      expectedCapped: false,
    },
    {
      name: "1 signal (quiz 100, jd) is capped at 65",
      input: {
        source: "jd",
        quizScores: [100],
        labPassed: false,
        labSubmitted: false,
        latestConfidence: null,
      },
      expectedScore: 65,
      expectedStatus: "learning",
      expectedCapped: true,
    },
    {
      name: "1 signal (quiz 20, github) preserves github baseline floor 40",
      input: {
        source: "github",
        quizScores: [20],
        labPassed: false,
        labSubmitted: false,
        latestConfidence: null,
      },
      expectedScore: 40,
      expectedStatus: "learning",
      expectedCapped: false,
    },
    {
      name: "1 signal (lab submitted only, jd) scores 50 without cap flag",
      input: {
        source: "jd",
        quizScores: [],
        labPassed: false,
        labSubmitted: true,
        latestConfidence: null,
      },
      expectedScore: 50,
      expectedStatus: "learning",
      expectedCapped: false,
    },
    {
      name: "1 signal (lab passed only, jd) is capped at 65",
      input: {
        source: "jd",
        quizScores: [],
        labPassed: true,
        labSubmitted: true,
        latestConfidence: null,
      },
      expectedScore: 65,
      expectedStatus: "learning",
      expectedCapped: true,
    },
    {
      name: "1 signal (interview ready only, manual) is capped at 65",
      input: {
        source: "manual",
        quizScores: [],
        labPassed: false,
        labSubmitted: false,
        latestConfidence: "ready",
      },
      expectedScore: 65,
      expectedStatus: "learning",
      expectedCapped: true,
    },
    {
      name: "2 signals (latest 3 quiz avg 90 + interview ready 100) renormalizes 30/30 -> 95",
      input: {
        source: "jd",
        quizScores: [100, 80, 90, 10],
        labPassed: false,
        labSubmitted: false,
        latestConfidence: "ready",
      },
      expectedScore: 95,
      expectedStatus: "mastered",
      expectedCapped: false,
    },
    {
      name: "2 signals (quiz 80 + lab passed 100) renormalizes 30/40 -> 91",
      input: {
        source: "jd",
        quizScores: [80],
        labPassed: true,
        labSubmitted: true,
        latestConfidence: null,
      },
      expectedScore: 91,
      expectedStatus: "mastered",
      expectedCapped: false,
    },
    {
      name: "3 signals (quiz 60 + lab submitted 50 + interview partial 65) -> 58",
      input: {
        source: "manual",
        quizScores: [60],
        labPassed: false,
        labSubmitted: true,
        latestConfidence: "partial",
      },
      expectedScore: 58,
      expectedStatus: "learning",
      expectedCapped: false,
    },
  ];

  it.each(cases)(
    "$name",
    ({ input, expectedScore, expectedStatus, expectedCapped }) => {
      const result = calculateMasteryBreakdown(input);
      expect(result.masteryScore).toBe(expectedScore);
      expect(result.status).toBe(expectedStatus);
      expect(result.capped).toBe(expectedCapped);
    },
  );
});

describe("calculateReadinessMeter", () => {
  it.each<{ name: string; items: ReadinessItem[]; expected: number }>([
    { name: "empty skills returns 0", items: [], expected: 0 },
    {
      name: "must_have only averages cleanly",
      items: [
        { masteryScore: 80, priority: "must_have" },
        { masteryScore: 40, priority: "must_have" },
      ],
      expected: 60,
    },
    {
      name: "nice_to_have only averages cleanly",
      items: [
        { masteryScore: 90, priority: "nice_to_have" },
        { masteryScore: 30, priority: "nice_to_have" },
      ],
      expected: 60,
    },
    {
      name: "mixed weights must_have=2 and nice_to_have=1",
      items: [
        { masteryScore: 80, priority: "must_have" },
        { masteryScore: 20, priority: "nice_to_have" },
      ],
      expected: 60,
    },
  ])("$name", ({ items, expected }) => {
    expect(calculateReadinessMeter(items)).toBe(expected);
  });
});
