import { describe, expect, it } from "vitest";
import {
  calculateLearningStreak,
  pickTodaysFocus,
} from "@/lib/todays-focus";

describe("pickTodaysFocus", () => {
  const dueCard = {
    id: "card-1",
    question_prompt: "Apa perbedaan B-Tree dan GIN index?",
    skillName: "PostgreSQL",
    next_review_at: "2026-11-26T08:00:00.000Z",
  };
  const unreadDigest = {
    id: "digest-1",
    title: "Understanding Postgres Locks",
    source: "devto",
    skillName: "PostgreSQL",
  };
  const activeModule = {
    id: "mod-1",
    track_id: "track-1",
    objective: "Implementasikan ledger constraint.",
    capstoneTitle: "OrderLedger Hub",
    skillName: "PostgreSQL",
    order_index: 1,
  };

  it("prioritizes due InterviewCard over unread DailyDigest and active TrackModule", () => {
    const focus = pickTodaysFocus({
      dueInterviewCards: [dueCard],
      unreadDigests: [unreadDigest],
      activeTrackModules: [activeModule],
    });

    expect(focus.kind).toBe("interview");
    expect(focus.href).toBe("/interview");
    expect(focus.description).toContain("B-Tree");
  });

  it("picks unread DailyDigest when no InterviewCard is due, then active TrackModule", () => {
    const digestFocus = pickTodaysFocus({
      dueInterviewCards: [],
      unreadDigests: [unreadDigest],
      activeTrackModules: [activeModule],
    });
    expect(digestFocus.kind).toBe("digest");
    expect(digestFocus.href).toBe("/digest");

    const moduleFocus = pickTodaysFocus({
      dueInterviewCards: [],
      unreadDigests: [],
      activeTrackModules: [activeModule],
    });
    expect(moduleFocus.kind).toBe("module");
    expect(moduleFocus.href).toBe("/tracks/track-1/modules/mod-1");
  });

  it("returns empty CTA when no priority items exist", () => {
    const emptyFocus = pickTodaysFocus({
      dueInterviewCards: [],
      unreadDigests: [],
      activeTrackModules: [],
    });
    expect(emptyFocus.kind).toBe("empty");
    expect(emptyFocus.href).toBe("/internships");
  });
});

describe("calculateLearningStreak", () => {
  it("counts consecutive active days with deduplicated same-day timestamps", () => {
    const today = "2026-11-27T10:00:00.000Z";
    const dates = [
      "2026-11-27T02:00:00.000Z",
      "2026-11-27T01:15:00.000Z", // duplicate day
      "2026-11-26T18:00:00.000Z",
      "2026-11-25T09:30:00.000Z",
      "2026-11-22T12:00:00.000Z", // gap before Nov 25
    ];

    expect(calculateLearningStreak(dates, today)).toBe(3);
  });

  it("preserves streak from yesterday when today has no activity yet, and returns 0 when broken", () => {
    const today = "2026-11-27T08:00:00.000Z";
    expect(
      calculateLearningStreak(
        ["2026-11-26T15:00:00.000Z", "2026-11-25T15:00:00.000Z"],
        today,
      ),
    ).toBe(2);

    expect(calculateLearningStreak(["2026-11-24T15:00:00.000Z"], today)).toBe(
      0,
    );
  });
});
