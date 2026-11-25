import type {
  ConfidenceLevel,
  SkillPriority,
  SkillSource,
  SkillStatus,
} from "@/types/database";

export type MasteryInput = {
  source: SkillSource;
  /** Quiz scores ordered newest-first; at most the latest 3 are averaged. */
  quizScores: number[];
  labPassed: boolean;
  labSubmitted: boolean;
  latestConfidence: ConfidenceLevel | null;
};

export type MasteryBreakdown = {
  masteryScore: number;
  status: SkillStatus;
  capped: boolean;
  breakdown: {
    quiz: number | null;
    lab: number | null;
    interview: number | null;
  };
};

export type ReadinessItem = {
  masteryScore: number;
  priority: SkillPriority;
};

const CONFIDENCE_SCORES: Record<ConfidenceLevel, number> = {
  confused: 25,
  partial: 65,
  ready: 100,
};

const SIGNAL_WEIGHTS = {
  quiz: 30,
  lab: 40,
  interview: 30,
} as const;

const SINGLE_SIGNAL_CAP = 65;
const GITHUB_BASELINE = 40;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function deriveSkillStatus(score: number): SkillStatus {
  const normalized = clampScore(score);
  if (normalized >= 80) return "mastered";
  if (normalized >= 30) return "learning";
  return "gap";
}

export function calculateMasteryBreakdown(input: MasteryInput): MasteryBreakdown {
  const recentQuizzes = input.quizScores.slice(0, 3);
  const quizAvg =
    recentQuizzes.length > 0
      ? recentQuizzes.reduce((sum, score) => sum + clampScore(score), 0) /
        recentQuizzes.length
      : null;

  const labScore = input.labPassed ? 100 : input.labSubmitted ? 50 : null;
  const interviewScore =
    input.latestConfidence !== null
      ? CONFIDENCE_SCORES[input.latestConfidence]
      : null;

  const activeSignals: Array<{ score: number; weight: number }> = [];
  if (quizAvg !== null) {
    activeSignals.push({ score: quizAvg, weight: SIGNAL_WEIGHTS.quiz });
  }
  if (labScore !== null) {
    activeSignals.push({ score: labScore, weight: SIGNAL_WEIGHTS.lab });
  }
  if (interviewScore !== null) {
    activeSignals.push({
      score: interviewScore,
      weight: SIGNAL_WEIGHTS.interview,
    });
  }

  let masteryScore: number;
  let capped = false;

  if (activeSignals.length === 0) {
    masteryScore = input.source === "github" ? GITHUB_BASELINE : 0;
  } else if (activeSignals.length === 1) {
    const raw = clampScore(activeSignals[0].score);
    capped = raw > SINGLE_SIGNAL_CAP;
    const bounded = Math.min(SINGLE_SIGNAL_CAP, raw);
    masteryScore =
      input.source === "github" ? Math.max(GITHUB_BASELINE, bounded) : bounded;
  } else {
    const totalWeight = activeSignals.reduce(
      (sum, signal) => sum + signal.weight,
      0,
    );
    const weightedSum = activeSignals.reduce(
      (sum, signal) => sum + signal.score * signal.weight,
      0,
    );
    masteryScore = clampScore(weightedSum / totalWeight);
  }

  return {
    masteryScore,
    status: deriveSkillStatus(masteryScore),
    capped,
    breakdown: {
      quiz: quizAvg !== null ? Math.round(quizAvg) : null,
      lab: labScore,
      interview: interviewScore,
    },
  };
}

export function calculateReadinessMeter(items: ReadinessItem[]): number {
  if (items.length === 0) return 0;

  let weightedScoreSum = 0;
  let totalWeight = 0;

  for (const item of items) {
    const weight = item.priority === "must_have" ? 2 : 1;
    weightedScoreSum += clampScore(item.masteryScore) * weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? 0 : clampScore(weightedScoreSum / totalWeight);
}
