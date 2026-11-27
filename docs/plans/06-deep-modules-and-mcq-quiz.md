# Plan 06 — Deep Study Guide, Module Tutor & MCQ Quiz (A/B/C/D)

**Fase:** 6 dari 9 (Upgrade v1.1 Paket 1: Materi Modul Mendalam 5 Blok, Tutor Kontekstual & Kuis Pilihan Ganda)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) (`Bagian 12`) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-002`, `ADR-005`, `ADR-006`, `ADR-008`, `ADR-011`, `ADR-013`)  
**Aturan Seam (`/codebase-design`):** `src/types/schemas.ts` menjaga kompatibilitas skema v1 & v2 `ConceptBrief`; `src/services/ai/{module-generator,module-tutor,mcq-generator}.ts` menerima adapter AI melalui argumen *seam* bebas primitif Next.js; `src/app/api/*` bertanggung jawab atas `maxDuration = 30`, guard `requireAllowedUser`, idempotensi/cache PostgreSQL `JSONB`, dan proteksi `forceRefresh`; komponen UI baru (`DeepConceptBriefView`, `ModuleTutorDrawer`, `McqQuizRunner`, `QuizWorkspaceTabs`) dipisah agar tidak membengkakkan komponen v1.0.  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Step 6.1 — Migrasi `0006`, Kontrak Zod `ConceptBrief` v2 & `McqQuestion`, + Upgrade `module-generator.ts`

- **Blocked by:** Fondasi v1.0 (`0005_tracks_and_labs_rpcs.sql`)
- **What to build:** Menambahkan migrasi DB `0006` (`module_mcq`, `note_mcq`, kolom `mcq_questions JSONB`), memperluas `conceptBriefSchema` agar *backward-compatible* sekaligus mendukung 5 blok Deep Study Guide Bahasa Indonesia, serta memperluas `module-generator.ts` dan endpoint generasi modul (`forceRefresh`) untuk menghasilkan materi v2 + 5 `McqQuestion` sekaligus.

### Daftar File
- `supabase/migrations/0006_deep_modules_and_mcq.sql` *(baru)*
- `src/types/database.ts` *(modifikasi: tambah enum `'module_mcq' | 'note_mcq'` & kolom nullable `mcq_questions`)*
- `src/types/schemas.ts` *(modifikasi: `conceptBriefSchema` v2 backward-compatible & `mcqQuestionSchema`)*
- `src/types/__tests__/schemas.test.ts` *(modifikasi: uji kompatibilitas `ConceptBrief` v1 vs v2 & validasi `McqQuestion`)*
- `src/services/ai/module-generator.ts` *(modifikasi: prompt 5 blok Deep Study Guide ID + 5 `mcq_questions`)*
- `src/services/ai/__tests__/module-generator.test.ts` *(modifikasi: uji output v2 + MCQ)*
- `src/app/api/tracks/[id]/modules/[moduleId]/generate/route.ts` *(modifikasi: dukung `forceRefresh` tervalidasi & simpan `mcq_questions`)*

### Tugas
- [ ] Buat migrasi `supabase/migrations/0006_deep_modules_and_mcq.sql`:
  - `alter type public.quiz_source_type add value if not exists 'module_mcq';`
  - `alter type public.quiz_source_type add value if not exists 'note_mcq';`
  - Tambah kolom nullable `mcq_questions jsonb` pada `public.track_modules` dan `public.notes`.
- [ ] Perbarui `src/types/database.ts` dan `src/types/schemas.ts`:
  - Perluas `conceptBriefSchema` dengan tetap mempertahankan `summary`, `analogy`, `key_points` (v1), serta menambah field v2 opsional untuk 5 blok wajib: *why / masalah dunia nyata*, *mental_model + diagram teks/ASCII*, *before_after_code (naive vs idiomatic + line breakdown)*, *trade_offs (when_to_use vs when_to_avoid)*, dan *common_pitfalls (3 item)*.
  - Tambahkan `mcqQuestionSchema` (`{ id, question, scenario_code?, options: 4 item { key: 'A'|'B'|'C'|'D', text }, correct_key, explanation, wrong_option_notes? }`) dan `mcqQuestionsSchema`.
- [ ] Perbarui `src/services/ai/module-generator.ts` dan `module-generator.test.ts`:
  - Instruksikan prompt menyusun Deep Study Guide berbahasa Indonesia yang runtut serta 5 `mcq_questions` konseptual sesuai `target_language` modul.
- [ ] Perbarui `src/app/api/tracks/[id]/modules/[moduleId]/generate/route.ts`:
  - Simpan `mcq_questions` bersama `concept_brief`, `warmup_drills`, `hands_on_ticket` ketika `content_status = 'ready'`.
  - Terima flag opsional `{ forceRefresh?: boolean }` dari body agar modul lama v1 dapat diperbarui ke materi v2 (tetap idempoten saat `forceRefresh` false/tidak dikirim).

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`schemas.test.ts` & `module-generator.test.ts` hijau).
- [ ] `npm run build` lulus tanpa error.
- [ ] Data `concept_brief` v1 lama tetap lolos `conceptBriefSchema.safeParse(...)`.

### Saran Conventional Commit
```text
feat(modules): add 0006 migration, backward-compatible deep study guide schema, and mcq generation
```

---

## Step 6.2 — UI `DeepConceptBriefView` & Contextual `ModuleTutor` (`POST /api/tracks/[id]/modules/[moduleId]/tutor`)

- **Blocked by:** `Step 6.1`
- **What to build:** Menampilkan materi 5 blok Bahasa Indonesia secara nyaman di Tab 1 modul (`DeepConceptBriefView.tsx`, fallback mulus untuk data v1 + tombol konfirmasi **"Perbarui ke Materi Mendalam"**), serta asisten **Module Tutor** *stateless* lewat drawer `Sheet` untuk menanyakan konsep yang belum dipahami.

### Daftar File
- `src/services/ai/module-tutor.ts` *(baru)*
- `src/services/ai/__tests__/module-tutor.test.ts` *(baru)*
- `src/app/api/tracks/[id]/modules/[moduleId]/tutor/route.ts` *(baru)*
- `src/components/tracks/DeepConceptBriefView.tsx` *(baru)*
- `src/components/tracks/ModuleTutorDrawer.tsx` *(baru)*
- `src/components/tracks/ModuleTabs.tsx` *(modifikasi: panggil `DeepConceptBriefView` & `ModuleTutorDrawer` di Tab 1 tanpa menambah bloat)*

### Tugas
- [ ] Bangun *deep module* `src/services/ai/module-tutor.ts` (`askModuleTutor(context, aiAdapter?)`) + `module-tutor.test.ts`:
  - Validasi batas pertanyaan maks. 500 karakter (`mode?: 'question' | 'simpler_analogy'`).
  - Konteks hanya berasal dari `skillName`, `targetLanguage`, dan `concept_brief` modul terkait (*stateless*, nol riwayat DB).
- [ ] Buat Route Handler tipis `src/app/api/tracks/[id]/modules/[moduleId]/tutor/route.ts` (`export const maxDuration = 30`):
  - Cek `requireAllowedUser()`, validasi UUID & payload Zod, pastikan modul dimiliki user & berstatus `content_status = 'ready'`, delegasikan ke `askModuleTutor`, tangani `429` secara ramah.
- [ ] Buat `src/components/tracks/DeepConceptBriefView.tsx` menggunakan token semantik Light/Dark:
  - Render 5 blok terstruktur (termasuk blok kode *Before vs After* + bedah per baris dan diagram alur ASCII/monospace) jika field v2 tersedia, atau fallback rapi v1 + tombol **"Perbarui ke Materi Mendalam"** dengan dialog konfirmasi hemat kuota yang memanggil `/generate` dengan `{ forceRefresh: true }`.
- [ ] Buat `src/components/tracks/ModuleTutorDrawer.tsx` memakai `Sheet` `shadcn/ui`:
  - Sediakan tombol cepat **"Jelaskan dengan Analogi Lebih Sederhana"** dan form pertanyaan maks. 500 karakter dengan state loading & penanganan `429`.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`module-tutor.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Cek visual Light & Dark Mode pada Tab 1 modul (`DeepConceptBriefView` & `ModuleTutorDrawer`): nol warna *hardcoded*.

### Saran Conventional Commit
```text
feat(modules): add deep study guide view and stateless contextual module tutor drawer
```

---

## Step 6.3 — Generator MCQ On-Demand (`POST /api/quiz/mcq/generate`) & Komponen `McqQuizRunner`

- **Blocked by:** `Step 6.1`
- **What to build:** Generator *on-demand* 5 soal pilihan ganda untuk `TrackModule` lama maupun `Note` yang belum memiliki `mcq_questions`, serta komponen `McqQuizRunner.tsx` 1 kartu per layar lengkap dengan pintasan keyboard, kotak pembahasan, dan pembaruan `MasteryScore`.

### Daftar File
- `src/services/ai/mcq-generator.ts` *(baru)*
- `src/services/ai/__tests__/mcq-generator.test.ts` *(baru)*
- `src/app/api/quiz/mcq/generate/route.ts` *(baru)*
- `src/actions/quiz.ts` *(sudah menerima `quizSourceTypeSchema` — verifikasi `'module_mcq' | 'note_mcq'` & revalidate path terkait)*
- `src/components/quiz/McqQuizRunner.tsx` *(baru)*

### Tugas
- [ ] Bangun *deep module* `src/services/ai/mcq-generator.ts` (`generateMcqQuestions(input, aiAdapter?)`) + unit test `mcq-generator.test.ts`:
  - Mendukung sumber `module` (berbasis `concept_brief` + `objective`) maupun `note` (berbasis `content_md` catatan setelah mensterilkan penanda `{{...}}`).
  - Menghasilkan tepat 5 `McqQuestion` tervalidasi Zod dengan 4 opsi `A/B/C/D`, `correct_key`, `explanation`, dan `wrong_option_notes`.
- [ ] Buat Route Handler tipis `src/app/api/quiz/mcq/generate/route.ts` (`export const maxDuration = 30`):
  - Terima `{ targetType: 'module' | 'note', targetId: uuid }`.
  - Cek kepemilikan via RLS; **jika `mcq_questions` sudah ada di DB, langsung kembalikan dari cache** (*Generate Once, Cache Forever*); jika kosong, panggil `generateMcqQuestions` lalu simpan permanen ke kolom `mcq_questions`.
- [ ] Bangun `src/components/quiz/McqQuizRunner.tsx` (terpisah dari `ClozeQuizRunner.tsx`):
  - Render **1 kartu soal per layar** dengan indikator progres `1 / 5` (`font-mono tabular-nums`), opsi `A/B/C/D`, serta pintasan keyboard `1–4` / `A–D` untuk memilih dan `Enter` untuk cek/lanjut.
  - Tombol **Cek Jawaban** langsung menampilkan badge benar (`--status-mastered`) / keliru (`--destructive`) + kotak pembahasan mengapa opsi benar tepat dan catatan opsi keliru pengguna → tombol **Soal Berikutnya**.
  - Setelah soal terakhir, tampilkan ringkasan skor dan panggil `submitQuizAttemptAction` (`sourceType: 'module_mcq' | 'note_mcq'`) agar `MasteryScore` & `skills.status` otomatis diperbarui.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`mcq-generator.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal: generate MCQ untuk satu `Note`, refresh halaman dan pastikan soal dimuat instan dari DB tanpa memanggil Gemini ulang; selesaikan 5 soal dan cek `quiz_attempts` & `MasteryScore` terbarui.

### Saran Conventional Commit
```text
feat(quiz): add on-demand mcq generator endpoint and interactive McqQuizRunner
```

---

## Step 6.4 — Integrasi Dual-Mode `/quiz` & Tab 2 Modul (`ModuleTabs.tsx`)

- **Blocked by:** `Step 6.3`
- **What to build:** Menghubungkan mode **Pilihan Ganda (A/B/C/D)** di halaman `/quiz` (bersanding dengan mode *Cloze*) dan di Tab 2 `TrackModule` (sebelum *Latihan Sintaks Inline-Blank*) tanpa merusak perilaku kuis Cloze maupun Drill v1.0.

### Daftar File
- `src/components/quiz/QuizWorkspaceTabs.tsx` *(baru — pembungkus 2 tab ringan di `/quiz`)*
- `src/app/(dashboard)/quiz/page.tsx` *(modifikasi: ikut query `mcq_questions` pada `notes` & `track_modules` dalam `Promise.all` yang sudah ada)*
- `src/components/tracks/ModuleTabs.tsx` *(modifikasi: Tab 2 punya sub-mode `Kuis Konsep (A/B/C/D)` + `Latihan Sintaks (Inline-Blank)`, serta terima prop `mcqQuestions`)*
- `src/app/(dashboard)/tracks/[id]/modules/[moduleId]/page.tsx` *(modifikasi: ikut select `mcq_questions` pada query `track_modules`)*

### Tugas
- [ ] Buat `src/components/quiz/QuizWorkspaceTabs.tsx` memakai `Tabs` `shadcn/ui`:
  - Tab 1: **Pilihan Ganda (A/B/C/D)** (pilih `Note` atau `TrackModule` ber-MCQ, sertakan tombol **Generate Soal MCQ (5 Butir)** untuk target yang `mcq_questions`-nya masih kosong via `/api/quiz/mcq/generate`).
  - Tab 2: **Isian Rumpang (Cloze)** merender `ClozeQuizRunner` yang sudah ada tanpa mengubah logikanya.
- [ ] Perbarui `src/app/(dashboard)/quiz/page.tsx` untuk meneruskan daftar catatan + modul praktikum (`id`, `title`/`objective`, `skill_id`, `mcq_questions`) ke `QuizWorkspaceTabs` dalam 1 `Promise.all` (nol panggilan AI saat render).
- [ ] Perbarui Tab 2 di `ModuleTabs.tsx` & `src/app/(dashboard)/tracks/[id]/modules/[moduleId]/page.tsx`:
  - Sediakan sub-switch rapi antara **Kuis Konsep (A/B/C/D)** (`McqQuizRunner`, sertakan tombol on-demand generate bila modul lama belum memiliki `mcq_questions`) dan **Latihan Sintaks (Inline-Blank)** (`InlineBlankDrillRunner`).

### Verification Checklist
- [ ] `npx tsc --noEmit` lulus dengan 0 error.
- [ ] `npm run lint` lulus dengan 0 error & 0 warning.
- [ ] `npm test` lulus 100%.
- [ ] `npm run build` produksi lulus tanpa error.
- [ ] Verifikasi manual `/quiz` dan `/tracks/[id]/modules/[moduleId]` di Light & Dark Mode: kedua mode kuis (MCQ & Cloze/Drill) berjalan penuh.

### Saran Conventional Commit
```text
feat(quiz): integrate dual-mode mcq and cloze/drill workspaces in /quiz and module tabs
```

---

## Handoff Log

*(Diisi setelah tiap sub-step lulus verifikasi dan disetujui pengguna.)*
