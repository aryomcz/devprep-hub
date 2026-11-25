# Plan 05 — Interview Lab, Today's Focus & Analytics Dashboard

**Fase:** 5 dari 5 (*Spaced Repetition* `InterviewCard`/`InterviewAttempt`, Simulator Timer 2 Menit, `Today's Focus`, & Dashboard Analitik)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-008`, `ADR-010`, `ADR-011`)  
**Aturan Seam (`/codebase-design`):** `src/lib/spaced-repetition.ts` dan `src/lib/todays-focus.ts` adalah modul komputasi murni *in-process* bebas I/O; `src/actions/interview.ts` mengelola transaksi `interview_attempts` (*append-only*) + pembaruan `interview_cards` + re-kalkulasi `MasteryScore`.  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Step 5.1 — Modul Domain Spaced Repetition (`src/lib/spaced-repetition.ts`) & Server Actions Interview

- **Blocked by:** `Step 1.3`, `Step 4.4`
- **What to build:** Mengimplementasikan algoritma jadwal pengulangan berkala (+2, +5, +14 hari) secara deterministik dan Server Actions untuk pembuatan `InterviewCard` serta pencatatan `InterviewAttempt` yang sekaligus memperbarui `MasteryScore`.

### Daftar File
- `src/lib/spaced-repetition.ts` *(baru)*
- `src/lib/__tests__/spaced-repetition.test.ts` *(baru)*
- `src/actions/interview.ts` *(baru)*

### Tugas
- [ ] Tulis unit test (`tdd`) terlebih dahulu di `src/lib/__tests__/spaced-repetition.test.ts` lalu implementasikan `src/lib/spaced-repetition.ts`:
  - `calculateNextReview(confidenceLevel, fromDate)`: `'confused' → +2 hari`, `'partial' → +5 hari`, `'ready' → +14 hari`.
  - `isCardDue(card, now)` dan `sortDueInterviewCards(cards, now)` (mengurutkan kartu jatuh tempo dari yang paling lama tertunda).
- [ ] Buat `src/actions/interview.ts` (terautentikasi `requireAllowedUser` via RLS):
  - `createInterviewCardAction`: tambah kartu manual (`source = 'manual'`) atau bangkitkan kartu dari topik `Skill` berstatus `gap` (`source = 'skill_gap'`).
  - `submitInterviewAttemptAction`: validasi Zod (`cardId`, `durationSeconds`, `userNotes`, `confidenceLevel`), sisipkan 1 baris baru *append-only* ke `interview_attempts`, perbarui `interview_cards` (`confidence_level`, `review_count + 1`, `next_review_at` dari `calculateNextReview`), hitung ulang `MasteryScore` & `SkillStatus` `Skill` terkait via `src/lib/mastery.ts`, perbarui tabel `skills`, lalu `revalidatePath('/interview')` dan `revalidatePath('/dashboard')`.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`spaced-repetition.test.ts` hijau).
- [ ] Cek domain invariant: `src/lib/spaced-repetition.ts` bebas dari `Date.now()` tersembunyi (menerima `fromDate` / `now` lewat argumen *seam* sehingga 100% deterministik).

### Saran Conventional Commit
```text
feat(interview): add spaced repetition scheduler and interview card/attempt actions
```

---

## Step 5.2 — Workspace `/interview`: Countdown Timer 2 Menit, Kerangka 3 Poin & Antrean Review

- **Blocked by:** `Step 5.1`
- **What to build:** Membangun UI lengkap *Interview Lab* di `/interview` dengan antrean `InterviewCard` jatuh tempo, filter asal kartu (`lab_review`, `skill_gap`, `manual`), simulator timer 2 menit, kerangka jawaban 3 poin, dan histori `InterviewAttempt`.

### Daftar File
- `src/components/interview/SpacedRepetitionQueue.tsx` *(baru)*
- `src/components/interview/InterviewTimer.tsx` *(baru)*
- `src/app/(dashboard)/interview/page.tsx` *(baru)*

### Tugas
- [ ] Bangun `src/components/interview/SpacedRepetitionQueue.tsx`: tampilkan daftar `InterviewCard` yang jatuh tempo hari ini (`next_review_at <= NOW()`) maupun kartu terjadwal mendatang, lengkap dengan badge `Skill`, sumber kartu (`lab_review | skill_gap | manual`), `review_count`, filter per `Skill`, serta modal/form tambah kartu manual atau seed dari `skill_gap`.
- [ ] Bangun `src/components/interview/InterviewTimer.tsx`:
  - *Countdown timer* default 2 menit (120 detik) dengan tombol Mulai, Jeda, dan Reset yang mencatat `duration_seconds` aktual.
  - Panduan terstruktur kerangka 3 poin: *(1) Definisi, (2) Masalah yang diselesaikan, (3) Trade-off & batasan* beserta `<textarea>` catatan jawaban (`user_notes`).
  - Tombol evaluasi mandiri (`confused` → +2 hari, `partial` → +5 hari, `ready` → +14 hari) yang memanggil `submitInterviewAttemptAction`, serta panel riwayat `InterviewAttempt` sebelumnya pada kartu yang sama.
- [ ] Bangun halaman `src/app/(dashboard)/interview/page.tsx` untuk memuat antrean `InterviewCard`, daftar `Skill`, dan riwayat `InterviewAttempt` terbaru.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal: latih 1 `InterviewCard` hasil `lab_review`, pilih `partial`, pastikan baris baru masuk ke `interview_attempts`, `next_review_at` bergeser +5 hari sehingga kartu keluar dari antrean *due* hari ini, dan `MasteryScore` skill terkait terbarui.

### Saran Conventional Commit
```text
feat(interview): build interview lab workspace with 2-minute timer and review queue
```

---

## Step 5.3 — Modul Domain `todays-focus.ts`, Dashboard Utama `/dashboard` & Audit Seam Lintas Lapisan

- **Blocked by:** `Step 3.4`, `Step 4.4`, `Step 5.2`
- **What to build:** Mengimplementasikan kalkulator prioritas harian deterministik `Today's Focus` dan *learning streak*, melengkapi `/dashboard` dengan analitik menyeluruh, serta menuntaskan audit batas 4 lapisan & verifikasi build akhir.

### Daftar File
- `src/lib/todays-focus.ts` *(baru)*
- `src/lib/__tests__/todays-focus.test.ts` *(baru)*
- `src/components/dashboard/TodaysFocusCard.tsx` *(baru)*
- `src/components/dashboard/ReadinessOverview.tsx` *(baru)*
- `src/components/dashboard/MasteryChart.tsx` *(baru)*
- `src/app/(dashboard)/dashboard/page.tsx` *(modifikasi: ganti placeholder menjadi dashboard penuh)*

### Tugas
- [ ] Bangun modul murni *in-process* `src/lib/todays-focus.ts` dengan TDD (`todays-focus.test.ts`):
  - `pickTodaysFocus({ dueInterviewCards, unreadDigests, activeTrackModules })`: prioritas deterministik *(1) `InterviewCard` jatuh tempo → (2) `DailyDigest` belum dibaca → (3) `TrackModule` berstatus `in_progress`*, tanpa memanggil LLM.
  - `calculateLearningStreak(activityDates, today)`: menghitung jumlah hari aktif beruntun dari aktivitas `quiz_attempts`, `lab_submissions`, dan `interview_attempts`.
- [ ] Bangun komponen dashboard di `src/components/dashboard/`:
  - `TodaysFocusCard.tsx` (kartu prioritas utama dengan CTA langsung ke `/interview`, `/digest`, atau `/tracks/[id]/modules/[moduleId]`).
  - `ReadinessOverview.tsx` (ringkasan `ReadinessMeter` target magang teratas dan progres `One-App Capstone` aktif).
  - `MasteryChart.tsx` (ringkasan `MasteryScore` per `Skill`, tren `QuizAttempt`, dan *learning streak*).
- [ ] Lengkapi `src/app/(dashboard)/dashboard/page.tsx` sebagai Server Component yang hanya membaca data ter-cache dari PostgreSQL via RLS (nol panggilan Gemini/Public API pada halaman baca).
- [ ] Lakukan audit batas modul (`ADR-011`) untuk memastikan: `src/lib/` bebas NextRequest/UI, `src/services/` bebas primitif Next.js (`cookies`/`revalidatePath`/`NextRequest`), `src/actions/` tidak memanggil Gemini/Public API, dan `SUPABASE_SECRET_KEY` hanya dipakai di `/api/cron/daily-digest`.

### Verification Checklist
- [ ] `npx tsc --noEmit` lulus dengan 0 error.
- [ ] `npm run lint` lulus dengan 0 error.
- [ ] `npm test` menjalankan seluruh unit & seam test (`schemas`, `auth-guard`, `skill-normalizer`, `mastery`, `cloze-parser`, `diff-sanitizer`, `spaced-repetition`, `todays-focus`, `github`, `lookup`, `hybrid-sourcing`, `daily-digest`, `jd-analyzer`, `track-generator`, `module-generator`, `code-reviewer`) dan 100% lulus.
- [ ] `npm run build` produksi lulus tanpa error.

### Saran Conventional Commit
```text
feat(dashboard): add deterministic todays focus card, mastery analytics, and final seam check
```

---

## Handoff Log

*(Kosong — akan diisi setelah setiap sub-step dikonfirmasi lulus verifikasi)*
