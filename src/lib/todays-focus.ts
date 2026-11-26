export type TodaysFocusKind = "interview" | "digest" | "module" | "empty";

export type TodaysFocusResult = {
  kind: TodaysFocusKind;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  badgeLabel: string;
};

export type TodaysFocusInput = {
  dueInterviewCards: Array<{
    id: string;
    question_prompt: string;
    skillName?: string;
    next_review_at: string;
  }>;
  unreadDigests: Array<{
    id: string;
    title: string;
    source: string;
    skillName?: string;
  }>;
  activeTrackModules: Array<{
    id: string;
    track_id: string;
    objective: string;
    capstoneTitle?: string;
    skillName?: string;
    order_index: number;
  }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function pickTodaysFocus(input: TodaysFocusInput): TodaysFocusResult {
  const firstCard = input.dueInterviewCards[0];
  if (firstCard) {
    const count = input.dueInterviewCards.length;
    return {
      kind: "interview",
      badgeLabel: `${count} Kartu Jatuh Tempo`,
      title: firstCard.skillName
        ? `Latihan Interview: ${firstCard.skillName}`
        : "Latihan Kartu Interview Jatuh Tempo",
      description: firstCard.question_prompt,
      ctaLabel: "Mulai Simulasi 2 Menit",
      href: "/interview",
    };
  }

  const firstDigest = input.unreadDigests[0];
  if (firstDigest) {
    const count = input.unreadDigests.length;
    return {
      kind: "digest",
      badgeLabel: `${count} Digest Belum Dibaca`,
      title: firstDigest.title,
      description: firstDigest.skillName
        ? `Bacaan terkurasi (${firstDigest.source}) untuk skill ${firstDigest.skillName}.`
        : `Artikel teknis pilihan (${firstDigest.source}) menunggu dibaca.`,
      ctaLabel: "Baca Daily Digest",
      href: "/digest",
    };
  }

  const firstModule = input.activeTrackModules[0];
  if (firstModule) {
    const label = firstModule.skillName
      ? `Modul #${firstModule.order_index}: ${firstModule.skillName}`
      : `Modul #${firstModule.order_index} Capstone`;
    return {
      kind: "module",
      badgeLabel: firstModule.capstoneTitle ?? "Capstone Aktif",
      title: label,
      description: firstModule.objective,
      ctaLabel: "Lanjutkan Praktikum",
      href: `/tracks/${firstModule.track_id}/modules/${firstModule.id}`,
    };
  }

  return {
    kind: "empty",
    badgeLabel: "Siap Mulai",
    title: "Mulai Target Magang atau Capstone Track",
    description:
      "Analisis lowongan magang baru atau buat Learning Track agar prioritas harian Anda terisi otomatis.",
    ctaLabel: "Buka Target Magang",
    href: "/internships",
  };
}

function toUtcDayMs(value: string | Date): number | null {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function calculateLearningStreak(
  activityDates: ReadonlyArray<string | Date>,
  today: string | Date,
): number {
  const todayDayMs = toUtcDayMs(today);
  if (todayDayMs === null) return 0;

  const uniqueDays = new Set<number>();
  for (const entry of activityDates) {
    const dayMs = toUtcDayMs(entry);
    if (dayMs !== null && dayMs <= todayDayMs) {
      uniqueDays.add(dayMs);
    }
  }

  if (uniqueDays.size === 0) return 0;

  // Keep an active streak intact until the end of today if yesterday had activity.
  let cursor = uniqueDays.has(todayDayMs) ? todayDayMs : todayDayMs - DAY_MS;
  if (!uniqueDays.has(cursor)) {
    return 0;
  }

  let streak = 0;
  while (uniqueDays.has(cursor)) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}
