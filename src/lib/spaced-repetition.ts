import type { ConfidenceLevel } from "@/types/database";

const DAY_MS = 24 * 60 * 60 * 1000;

export const REVIEW_INTERVAL_DAYS: Record<ConfidenceLevel, number> = {
  confused: 2,
  partial: 5,
  ready: 14,
};

function toTimestampMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

export function calculateNextReview(
  confidenceLevel: ConfidenceLevel,
  fromDate: Date,
): Date {
  const days = REVIEW_INTERVAL_DAYS[confidenceLevel];
  return new Date(fromDate.getTime() + days * DAY_MS);
}

export function isCardDue(
  card: { next_review_at: string | Date },
  now: Date,
): boolean {
  const dueMs = toTimestampMs(card.next_review_at);
  return Number.isFinite(dueMs) && dueMs <= now.getTime();
}

export function sortDueInterviewCards<
  T extends { next_review_at: string | Date },
>(cards: readonly T[], now: Date): T[] {
  return cards
    .filter((card) => isCardDue(card, now))
    .sort(
      (a, b) =>
        toTimestampMs(a.next_review_at) - toTimestampMs(b.next_review_at),
    );
}
