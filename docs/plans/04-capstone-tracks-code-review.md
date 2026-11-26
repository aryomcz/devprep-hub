# Plan 04 — One-App Capstone, On-Demand Track Modules & AI Lab Review

**Fase:** 4 dari 5 (Generator Blueprint Capstone 2-Tahap, *On-Demand Module*, *Inline-Blank Drill*, *Progressive Hints*, & *Lab Review*)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-002`, `ADR-006`, `ADR-008`, `ADR-009`, `ADR-010`, `ADR-011`)  
**Aturan Seam (`/codebase-design`):** `src/lib/diff-sanitizer.ts` adalah modul murni *in-process*; `src/services/ai/{track-generator,module-generator,code-reviewer}.ts` adalah *deep modules* yang menerima adapter LLM di *seam* argumen tanpa primitif Next.js; `src/app/api/*` bertanggung jawab atas `maxDuration = 30`, guard sesi, transaksi cache DB, dan penyisipan 2 `InterviewCard` baru.  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Step 4.1 — Stage 1 Capstone Track Blueprint Generator (`POST /api/tracks/generate`) & Halaman `/tracks`

- **Blocked by:** `Step 3.2`
- **What to build:** Membangun generator tahap 1 (`LearningTrack` + kerangka berurutan `TrackModule` berstatus `content_status = 'pending'`) beserta halaman `/tracks` dan peta arsitektur `/tracks/[id]`.

### Daftar File
- `src/services/ai/track-generator.ts` *(baru)*
- `src/services/ai/__tests__/track-generator.test.ts` *(baru)*
- `src/app/api/tracks/generate/route.ts` *(baru)*
- `src/actions/tracks.ts` *(baru)*
- `src/app/(dashboard)/tracks/page.tsx` *(baru)*
- `src/app/(dashboard)/tracks/[id]/page.tsx` *(baru)*

### Tugas
- [x] Bangun `src/services/ai/track-generator.ts` (`generateTrackBlueprint(input, aiAdapter?)`):
  - Terima input dari satu `TargetInternship` atau daftar `Skill` prioritas (beserta pilihan mode untuk topik bahasa baru: `microservice` vs `language_native`).
  - Hasilkan `capstone_title`, `capstone_description`, `primary_stack`, `architecture_overview`, dan urutan kerangka `TrackModule` (`skill_id`, `order_index`, `module_type`, `target_language`, `objective`) tanpa mengisi detail berat (`concept_brief`, `warmup_drills`, `hands_on_ticket`).
- [x] Tulis `src/services/ai/__tests__/track-generator.test.ts` menggunakan *mock AI adapter* untuk menguji validasi skema Zod blueprint, pengurutan `order_index`, serta klasifikasi `capstone_feature` vs `microservice`/`language_native`.
- [x] Buat Route Handler tipis `src/app/api/tracks/generate/route.ts` (`export const maxDuration = 30`): cek `requireAllowedUser`, panggil `generateTrackBlueprint`, simpan `learning_tracks` dan `track_modules` dengan `content_status = 'pending'`, modul pertama `status = 'in_progress'`, dan modul berikutnya `status = 'locked'`.
- [x] Buat `src/actions/tracks.ts` (arsip/ubah status `LearningTrack` & *unlock* modul berikutnya) serta bangun `/tracks` (daftar track + form pilih target lowongan/skill) dan `/tracks/[id]` (cetak biru arsitektur Capstone + peta modul dengan badge `status` & `content_status`).

### Verification Checklist
- [x] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`track-generator.test.ts` hijau).
- [x] `npm run build` lulus.
- [x] Verifikasi lokal: generate Track dari `/internships/[id]` atau `/tracks`, pastikan `learning_tracks` + kerangka `track_modules` (`content_status = 'pending'`) tersimpan cepat tanpa menunggu isi modul detail.

### Saran Conventional Commit
```text
feat(tracks): add stage-1 capstone blueprint generator and track overview pages
```

---

## Step 4.2 — Stage 2 On-Demand Module Generator (`POST /api/tracks/[id]/modules/[moduleId]/generate`) & Tab Concept Brief

- **Blocked by:** `Step 3.3`, `Step 4.1`
- **What to build:** Mengimplementasikan generasi detail `TrackModule` secara *on-demand* (`ADR-006`) yang menggabungkan `HybridSourcing` (`Step 3.3`) + Gemini terfokus, cache permanen ke `JSONB`, UI 4 tab modul, Tab 1 *Concept Brief* (+ tombol **Save to Note**), serta state pemulihan *"Coba Generate Ulang"*.

### Daftar File
- `src/services/ai/module-generator.ts` *(baru)*
- `src/services/ai/__tests__/module-generator.test.ts` *(baru)*
- `src/app/api/tracks/[id]/modules/[moduleId]/generate/route.ts` *(baru)*
- `src/components/tracks/ModuleTabs.tsx` *(baru)*
- `src/app/(dashboard)/tracks/[id]/modules/[moduleId]/page.tsx` *(baru)*

### Tugas
- [x] Bangun `src/services/ai/module-generator.ts` (`generateModuleContent(context, aiAdapter?)`):
  - Terima konteks `One-App Capstone`, `objective` modul, daftar `CuratedResource`, dan `target_language`.
  - Hasilkan `concept_brief`, 3–5 `warmup_drills` (kode berpenanda slot `___BLANK_1___` dst.), dan `hands_on_ticket` (*Acceptance Criteria* + 3 level `ProgressiveHints`), seluruhnya tervalidasi Zod.
- [x] Tulis `src/services/ai/__tests__/module-generator.test.ts` untuk memverifikasi kontrak Zod `concept_brief`, ketersediaan slot `___BLANK_i___` pada `warmup_drills`, kelengkapan 3 level hint, serta propagasi error `429`.
- [x] Buat Route Handler tipis `src/app/api/tracks/[id]/modules/[moduleId]/generate/route.ts` (`export const maxDuration = 30`):
  - Verifikasi `requireAllowedUser` dan kepemilikan track/modul.
  - Jika `content_status === 'ready'`, langsung kembalikan data ter-cache tanpa memanggil AI (idempoten).
  - Jalankan `getOrFetchCuratedResources` (`Step 3.3`, cache 7 hari), lalu panggil `generateModuleContent` (maks. 1 *retry*); simpan hasil permanen ke `track_modules` (`content_status = 'ready'`), atau tandai `content_status = 'failed'` bila gagal/`429`.
- [x] Bangun `/tracks/[id]/modules/[moduleId]/page.tsx` dan `ModuleTabs.tsx`:
  - Saat `content_status === 'pending'`, picu endpoint generasi *on-demand* dengan indikator loading yang jelas; saat `failed`, tampilkan pesan ramah & tombol **"Coba Generate Ulang"**.
  - Implementasikan **Tab 1: Concept Brief** (ringkasan konsep, analogi, daftar `CuratedResource` ber-tautan sumber resmi, dan tombol 1-klik **Save to Note** memanggil `saveToNoteAction`).

### Verification Checklist
- [x] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`module-generator.test.ts` hijau).
- [x] `npm run build` lulus.
- [x] Verifikasi lokal: buka modul pertama berstatus `pending`, pastikan konten ter-generate sekali & tersimpan sebagai `ready`, lalu refresh halaman dan pastikan dimuat instan dari PostgreSQL tanpa panggilan Gemini ulang.

### Saran Conventional Commit
```text
feat(modules): add on-demand module content generator and concept brief tab
```

---

## Step 4.3 — Inline-Blank Warm-up Drill Runner (Tab 2) & Hands-On Ticket + Progressive Hints (Tab 3)

- **Blocked by:** `Step 4.2`, `Step 2.4`
- **What to build:** Mengimplementasikan **Tab 2 (`Warm-up Drill`)** sebagai blok kode *read-only* ber-*syntax highlight* ringan dengan `<input>` *inline* (`ADR-009`) yang terhubung ke `submitQuizAttemptAction`, serta **Tab 3 (`Hands-On Ticket`)** dengan pembukaan bertahap `ProgressiveHints` 3 tingkat.

### Daftar File
- `package.json` *(modifikasi bila memasang paket syntax highlighter ringan seperti `prism-react-renderer`)*
- `src/components/tracks/InlineBlankDrillRunner.tsx` *(baru)*
- `src/components/tracks/ProgressiveHints.tsx` *(baru)*
- `src/components/tracks/ModuleTabs.tsx` *(modifikasi: sambungkan Tab 2 & Tab 3)*

### Tugas
- [x] Bangun `src/components/tracks/InlineBlankDrillRunner.tsx` (tanpa Monaco/CodeMirror sesuai `ADR-009`):
  - Render potongan kode *read-only* dengan pewarnaan sintaks ringan dan sisipkan `<input>` *inline* monospace langsung di posisi token `___BLANK_1___` dst.
  - Dukung navigasi tombol `Tab` berurutan antar input slot, umpan balik benar/salah per slot, serta pengiriman skor akhir melalui `submitQuizAttemptAction` (`sourceType: 'module_drill'`) agar `MasteryScore` `Skill` otomatis terbarui.
- [x] Bangun `src/components/tracks/ProgressiveHints.tsx`:
  - Tampilkan konteks masalah dan daftar *Acceptance Criteria* terukur.
  - Sediakan 3 tombol berjenjang yang terbuka bertahap: **Level 1: Arsitektur** → **Level 2: Pseudocode** → **Level 3: Contoh Implementasi**.
- [x] Integrasikan `InlineBlankDrillRunner` (Tab 2) dan `ProgressiveHints` (Tab 3) ke `ModuleTabs.tsx`.

### Verification Checklist
- [x] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [x] `npm run build` lulus.
- [x] Verifikasi lokal: isi seluruh slot `<input>` *inline* di Tab 2 menggunakan tombol `Tab`, kirim jawaban, dan pastikan `quiz_attempts` bertambah dengan `source_type = 'module_drill'` serta `MasteryScore` terbarui.

### Saran Conventional Commit
```text
feat(modules): add inline-blank warmup drill runner and progressive hints ticket tab
```

---

## Step 4.4 — Diff Sanitizer, AI Code Reviewer (`POST /api/labs/review`) & Auto-Create `InterviewCard` (Tab 4)

- **Blocked by:** `Step 4.3`, `Step 1.4`
- **What to build:** Menyelesaikan **Tab 4 (`Code Review`)** melalui modul murni `diff-sanitizer.ts`, penarikan diff commit GitHub, evaluasi AI terhadap *Acceptance Criteria*, penyimpanan `LabSubmission`, serta pembuatan otomatis **2 `InterviewCard` baru** (`source = 'lab_review'`).

### Daftar File
- `src/lib/diff-sanitizer.ts` *(baru)*
- `src/lib/__tests__/diff-sanitizer.test.ts` *(baru)*
- `src/services/external/github.ts` *(modifikasi: tambah `fetchSanitizedCommitDiff`)*
- `src/services/ai/code-reviewer.ts` *(baru)*
- `src/services/ai/__tests__/code-reviewer.test.ts` *(baru)*
- `src/app/api/labs/review/route.ts` *(baru)*
- `src/components/tracks/CodeReviewPanel.tsx` *(baru)*
- `src/components/tracks/ModuleTabs.tsx` *(modifikasi: sambungkan Tab 4)*

### Tugas
- [ ] Bangun `src/lib/diff-sanitizer.ts` dengan TDD (`diff-sanitizer.test.ts`): parsing/penyaringan blok diff agar membuang *lockfile* (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), file binary/gambar, serta memangkas total panjang teks menjadi **maks. 12.000 karakter** dengan penanda pemotongan yang jelas.
- [ ] Tambahkan `fetchSanitizedCommitDiff(commitUrl, adapter?)` di `src/services/external/github.ts` untuk mengambil diff dari URL commit GitHub (timeout 4 detik) lalu menyaringnya dengan `diff-sanitizer.ts`.
- [ ] Bangun *deep module* `src/services/ai/code-reviewer.ts` (`reviewLabSubmission(input, aiAdapter?)`) beserta unit test `code-reviewer.test.ts`: mengevaluasi kode/diff terhadap daftar *Acceptance Criteria* modul, mengeluarkan `{ passed, criteria_met[], improvements[], summary }`, dan merumuskan **tepat 2 pertanyaan wawancara spesifik** dari kode yang ditulis pengguna.
- [ ] Buat Route Handler tipis `src/app/api/labs/review/route.ts` (`export const maxDuration = 30`):
  - Verifikasi `requireAllowedUser`, ambil diff bila input berupa `repo_commit_url` atau sanitasi potongan kode (`<textarea>` monospace).
  - Panggil `reviewLabSubmission`, simpan ke `lab_submissions`.
  - **Otomatis sisipkan 2 baris baru ke `interview_cards`** (`source = 'lab_review'`, `lab_submission_id` terisi, `next_review_at = NOW()`).
  - Jika `passed = true`, ubah status modul menjadi `completed` (dan buka kunci modul berikutnya) serta hitung ulang `MasteryScore` & `SkillStatus` via `src/lib/mastery.ts`.
- [ ] Bangun `src/components/tracks/CodeReviewPanel.tsx` (pilihan input potongan kode `<textarea>` monospace atau URL commit GitHub, tampilan hasil *Acceptance Criteria*, catatan perbaikan, daftar 2 pertanyaan interview baru, dan riwayat `LabSubmission`).

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`diff-sanitizer.test.ts` & `code-reviewer.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal: submit potongan kode atau commit URL di Tab 4, pastikan `lab_submissions` tersimpan, `MasteryScore` skill meningkat, dan 2 `InterviewCard` baru muncul untuk skill tersebut.

### Saran Conventional Commit
```text
feat(labs): add diff sanitizer, ai code review endpoint, and auto interview card creation
```

---

## Handoff Log

- **2026-11-26 — Step 4.1 (Selesai & Di-commit):** *Deep service* Stage-1 `src/services/ai/track-generator.ts` + `track-generator.test.ts` (4/4 lulus, total 58/58 test hijau), endpoint `POST /api/tracks/generate` (`maxDuration = 30`), `src/actions/tracks.ts`, `TrackBlueprintControls.tsx`, serta halaman `/tracks` dan `/tracks/[id]`. Lulus `tsc --noEmit`, `npm run lint`, `npm test`, dan `npm run build`.
- **2026-11-26 — Step 4.2 (Selesai & Di-commit):** *Deep service* Stage-2 `src/services/ai/module-generator.ts` + `module-generator.test.ts` (3/3 lulus, total 61/61 test hijau), endpoint *on-demand* `POST /api/tracks/[id]/modules/[moduleId]/generate` (`maxDuration = 30`, idempoten + *Hybrid Sourcing* cache 7 hari), serta `ModuleTabs.tsx` (Tab 1 *Concept Brief* + *Save to Note* + tombol *Coba Generate Ulang*) dan `/tracks/[id]/modules/[moduleId]`. Lulus `tsc --noEmit`, `npm run lint`, `npm test`, dan `npm run build`.
- **2026-11-26 — Step 4.3 (Selesai & Di-commit):** `InlineBlankDrillRunner.tsx` (*syntax highlight* ringan tanpa Monaco/CodeMirror + inline `<input>` navigasi `Tab` + `submitQuizAttemptAction` `module_drill`), `ProgressiveHints.tsx` (3 tingkat berjenjang), serta integrasi Tab 2 & Tab 3 di `ModuleTabs.tsx`. Lulus `tsc --noEmit`, `npm run lint`, `npm test` (61/61), dan `npm run build`.
