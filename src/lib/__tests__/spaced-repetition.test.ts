import { describe, expect, it } from "vitest";
import {
  calculateNextReview,
  isCardDue,
  sortDueInterviewCards,
} from "@/lib/spaced-repetition";

describe("spaced-repetition", () => {
  const baseDate = new Date("2026-11-28T08:00:00.000Z");

  it("calculateNextReview adds +2, +5, or +14 days cleanly across month boundaries without mutating fromDate", () => {
    const frozenTime = baseDate.getTime();

    const confusedNext = calculateNextReview("confused", baseDate);
    const partialNext = calculateNextReview("partial", baseDate);
    const readyNext = calculateNextReview("ready", baseDate);

    expect(confusedNext.toISOString()).toBe("2026-11-30T08:00:00.000Z");
    expect(partialNext.toISOString()).toBe("2026-12-03T08:00:00.000Z");
    expect(readyNext.toISOString()).toBe("2026-12-12T08:00:00.000Z");
    expect(baseDate.getTime()).toBe(frozenTime);
  });

  it("isCardDue returns true for past or exact now timestamps and false for future timestamps", () => {
    expect(
      isCardDue({ next_review_at: "2026-11-28T07:59:59.000Z" }, baseDate),
    ).toBe(true);
    expect(
      isCardDue({ next_review_at: "2026-11-28T08:00:00.000Z" }, baseDate),
    ).toBe(true);
    expect(
      isCardDue({ next_review_at: "2026-11-28T08:00:01.000Z" }, baseDate),
    ).toBe(false);
  });

  it("sortDueInterviewCards filters due cards and sorts oldest-overdue first without mutating input", () => {
    const cards = [
      { id: "future", next_review_at: "2026-11-29T00:00:00.000Z" },
      { id: "due-newer", next_review_at: "2026-11-28T08:00:00.000Z" },
      { id: "due-oldest", next_review_at: "2026-11-25T10:00:00.000Z" },
      { id: "due-mid", next_review_at: "2026-11-27T12:00:00.000Z" },
    ];
    const originalIds = cards.map((c) => c.id);

    const sorted = sortDueInterviewCards(cards, baseDate);

    expect(sorted.map((c) => c.id)).toEqual([
      "due-oldest",
      "due-mid",
      "due-newer",
    ]);
    expect(cards.map((c) => c.id)).toEqual(originalIds);
  });
});
