# DevPrep Hub — Upgrade Brief v1.1 (Change Request & Planning Input)

Dokumen ini adalah masukan tunggal (*single source of input*) untuk menyusun rencana eksekusi **v1.1** (`docs/plans/06` s.d. `docs/plans/09`), memperbarui `docs/PRD.md`, `docs/GLOSSARY.md`, dan menambahkan `ADR-012` s.d. `ADR-015` di `docs/DECISIONS.md`.

---

## 1. Tujuan Upgrade v1.1

Menutup 4 celah terhadap kebutuhan asli pengguna dan meningkatkan kecepatan kerja harian tanpa merusak fondasi `v1.0` yang sudah berjalan:

1. **Materi Modul Lebih Mendalam & Mudah Dipahami + Kuis Kartu Pilihan Ganda (A/B/C/D):** Mengatasi materi modul yang terlalu ringkas dan kuis yang sebelumnya hanya berupa isian rumpang (*cloze/blank*).
2. **Radar Info Magang Terbuka + Upgrade Info Dunia IT (`/digest`):** Menambahkan pengambilan lowongan kerja terbuka secara otomatis + bantuan loker Indonesia, serta membuat *Daily Digest* lebih aktif, terpisah antara *skill gap* vs *trending IT*, dan dapat diringkas dalam bahasa Indonesia.
3. **Voice Interview (Gemini Audio Multimodal) + AI Delivery Review:** Menambahkan mode jawaban suara di `/interview` yang menilai isi kerangka 3 poin sekaligus gaya penyampaian (kejelasan, struktur alur bicara, dan *filler words*).
4. **Quality-of-Life & Produktivitas Harian:** Skeleton `loading.tsx`, navigasi cepat `Ctrl+K`, serta generator *Bullet CV ATS & Cerita STAR* dari proyek *One-App Capstone* yang sudah dikerjakan.

---

## 2. Guardrails Wajib (Non-Negotiable)

Seluruh rencana dan implementasi **v1.1** wajib mematuhi aturan proyek yang sudah terkunci:

- **Arsitektur 4 Lapisan (`ADR-011`):**
  - `src/lib/` → modul domain murni bebas I/O & primitif Next.js/UI (diuji langsung via `vitest`).
  - `src/services/{external,ai}/` → *deep modules* I/O eksternal yang menerima *injected adapter* pada argumen *seam* pengujian dan bebas dari `NextRequest`, `cookies()`, `headers()`, serta `revalidatePath`.
  - `src/actions/` → mutasi CRUD database terautentikasi via RLS + `revalidatePath`; **DILARANG** memanggil Gemini API atau Public API langsung.
  - `src/app/api/` → HTTP *adapter* tipis (`maxDuration = 30`, guard `requireAllowedUser` / `CRON_SECRET`, baca/tulis cache DB, delegasi ke `src/services/`).
- **Migrasi Database Inkremental:** Migrasi eksisting sudah sampai `0005_tracks_and_labs_rpcs.sql`. **DILARANG** mengedit file migrasi `0001`–`0005`. Seluruh skema baru wajib ditulis sebagai file migrasi baru mulai dari **`supabase/migrations/0006_*.sql`** lengkap dengan RLS penuh.
- **Anti-Bloat & Pemisahan Komponen (`ponytail`):** Jangan menumpuk fitur besar baru ke dalam file komponen yang sudah besar (`SkillTable.tsx`, `ClozeQuizRunner.tsx`, `MarkdownEditor.tsx`, `SpacedRepetitionQueue.tsx`, `CodeReviewPanel.tsx`, `InterviewTimer.tsx`). Pisahkan ke komponen baru yang ramping dan gunakan ulang primitif `shadcn/ui` serta token *Light/Dark Mode* yang sudah ada (tanpa warna *hardcoded*).
- **100% Free Tier & Keamanan:**
  - Terapkan *Generate Once, Cache Forever* di PostgreSQL (`JSONB`) untuk seluruh hasil AI dan cache berjangka untuk Public API.
  - **Tanpa Supabase Storage** untuk audio *Voice Interview* (file audio diproses *in-memory* lalu dibuang).
  - Seluruh panggilan Public API paralel memakai `Promise.allSettled` + `AbortSignal.timeout(4000)`.
  - Validasi ketat semua payload & `JSONB` menggunakan Zod.
  - Ikuti konvensi nama *env* yang sudah berjalan di `src/lib/supabase/*` dan `.env.example`; jangan hardcode secret apa pun.
- **Alur Git 1 Branch `main`:** Setiap *plan* dipecah menjadi 3–4 sub-step kecil (`Step X.1`, `Step X.2`, dst.) untuk alur *Stop–Verify–Commit* langsung di `main` (tanpa PR/feature branch).

---

## 3. Rincian 4 Paket Upgrade

### Paket 1 → `docs/plans/06-deep-modules-and-mcq-quiz.md`
**Fokus:** Memperdalam materi belajar di modul praktikum dan menghadirkan kuis kartu Pilihan Ganda (A/B/C/D) dengan pembahasan.

1. **Deep Study Guide (`concept_brief` v2):**
   - Perluas skema `ConceptBrief` (tetap *backward-compatible* dengan data `concept_brief` lama di DB lewat field opsional/fallback UI) di `src/types/schemas.ts` dan prompt `src/services/ai/module-generator.ts` agar materi ditulis dalam **Bahasa Indonesia yang runtut & mudah dipahami** dan mencakup 5 blok wajib:
     1. **Masalah Dunia Nyata (*Why*):** Kenapa konsep ini ada dan apa dampaknya jika tidak dipakai.
     2. **Analogi & Alur Kerja (*Mental Model*):** Penjelasan langkah demi langkah + diagram alur teks/ASCII sederhana.
     3. **Contoh Kode *Before vs After* + Bedah per Baris:** Perbandingan pendekatan naif vs pendekatan benar sesuai `target_language` modul.
     4. **Kapan Pakai vs Kapan Jangan Pakai (*Trade-off*):** Poin siap pakai untuk wawancara teknis.
     5. **Kesalahan Umum Pemula (*Common Pitfalls*):** 3 jebakan paling sering terjadi beserta cara menghindarinya.
   - Sediakan tombol **"Perbarui ke Materi Mendalam"** pada modul lama yang sudah `ready` (memicu regenerasi `concept_brief` dengan guard konfirmasi agar hemat kuota).
2. **Contextual Module Tutor (Ringan):**
   - Tambah endpoint tipis `POST /api/tracks/[id]/modules/[moduleId]/tutor` (`maxDuration = 30`) + *deep module* `src/services/ai/module-tutor.ts` (berbasis konteks `concept_brief` modul terkait, *stateless*, batas input pertanyaan maks. 500 karakter).
   - UI di Tab 1 modul (`ModuleTutorDrawer.tsx` memakai `Sheet` dari `shadcn/ui`): tombol cepat **"Jelaskan dengan Analogi Lebih Sederhana"** dan input pertanyaan singkat untuk bagian yang belum dipahami.
3. **Kuis Kartu Pilihan Ganda (MCQ A/B/C/D + Pembahasan):**
   - Migrasi `0006_deep_modules_and_mcq.sql`:
     - Tambah nilai enum `'module_mcq'` dan `'note_mcq'` pada `quiz_source_type`.
     - Tambah kolom nullable `mcq_questions JSONB` pada tabel `track_modules` dan `notes`.
   - Kontrak Zod `McqQuestionSchema`: `{ id, question, scenario_code?, options: [{ key: 'A'|'B'|'C'|'D', text }], correct_key, explanation, wrong_option_notes? }`.
   - Generasi & Cache:
     - `module-generator.ts` menghasilkan 5 soal MCQ konseptual per modul (atau dipicu *on-demand* untuk modul lama via `POST /api/quiz/mcq/generate`, lalu disimpan permanen ke `track_modules.mcq_questions` / `notes.mcq_questions`).
   - UI Baru `src/components/quiz/McqQuizRunner.tsx`:
     - Tampilan **1 kartu soal per layar** dengan 4 tombol opsi **A, B, C, D** (dukungan keyboard `1–4` / `A–D` & `Enter`).
     - Tombol **Cek Jawaban** → langsung menampilkan status hijau/merah + **kotak pembahasan** (mengapa opsi benar tepat dan mengapa opsi pilihan pengguna keliru) → tombol **Soal Berikutnya**.
     - Setelah soal terakhir selesai, simpan skor via `submitQuizAttemptAction` (`sourceType: 'module_mcq' | 'note_mcq'`) agar otomatis memperbarui `MasteryScore` di `src/lib/mastery.ts`.
   - Di halaman `/quiz`: tambahkan 2 tab mode yang jelas — **Pilihan Ganda (A/B/C/D)** dan **Isian Rumpang (Cloze)**.
   - Di Tab 2 `ModuleTabs.tsx`: sediakan sub-mode **Kuis Konsep (A/B/C/D)** sebelum **Latihan Sintaks (Inline-Blank)**.

---

### Paket 2 → `docs/plans/07-job-radar-and-it-news.md`
**Fokus:** Pengambilan info lowongan magang terbuka otomatis + peningkatan kurasi berita dunia IT.

1. **Job Radar Magang & Entry-Level:**
   - Migrasi `0007_job_radar_and_digest_upgrade.sql`:
     - Tabel cache `job_radar_cache` (`id`, `source`, `external_id`, `title`, `company_name`, `location`, `is_remote`, `url`, `description_snippet`, `tags TEXT[]`, `published_at`, `fetched_at`) dengan `UNIQUE (source, external_id)` dan RLS baca untuk user terautentikasi.
     - Tambah kolom `category TEXT DEFAULT 'skill_gap'` (`'skill_gap' | 'trending_it'`) dan `ai_summary JSONB nullable` pada `daily_digests`.
   - Deep module `src/services/external/job-radar.ts` + `job-radar.test.ts` (seam *injected fetch*):
     - Tarik lowongan *intern / junior / entry-level / software engineer* secara paralel dari **Arbeitnow API** dan **Remotive API** (`Promise.allSettled`, `AbortSignal.timeout(4000)`), tanpa API key, cache 12 jam di `job_radar_cache`.
   - Modul murni `src/lib/job-matcher.ts` + `job-matcher.test.ts`: menghitung estimasi skor kecocokan lowongan terhadap master `skills` pengguna secara deterministik (berdasarkan normalisasi `skill-normalizer.ts`, nol panggilan LLM).
   - Route Handler `GET /api/internships/radar` (dengan `?refresh=true` ber-cooldown) dan komponen baru `src/components/internships/JobRadarTab.tsx` di `/internships`:
     - Menampilkan daftar lowongan terbuka + badge persentase kecocokan *skill* + tombol **1-klik "Analisis ke Target Magang"** (mengisi otomatis form `JDAnalyzerForm`).
     - Blok **Pintasan Loker Magang Indonesia**: tautan filter otomatis (LinkedIn Jobs, Glints, Kalibrr) yang dirangkai dari 3–5 *skill* teratas pengguna agar mudah menemukan loker lokal lalu menyalinnya ke JD Analyzer.
2. **Upgrade Info Dunia IT (`/digest`):**
   - Perluas `daily-digest.ts` dan `/api/cron/daily-digest` agar menarik 2 kategori sekaligus: **Untuk Skill Gap-mu** (`skill_gap`) dan **Trending IT & Istilah Baru** (`trending_it` dari *top stories* Hacker News / Dev.to populer).
   - Tambah `POST /api/digest/refresh` (tombol **"Tarik Berita Sekarang"** di `/digest` dengan cooldown 6 jam agar hemat kuota).
   - Tambah `POST /api/digest/[id]/summarize` (`maxDuration = 30`) + `src/services/ai/digest-summarizer.ts`: menghasilkan ringkasan bahasa Indonesia 3 poin *(1. Inti berita, 2. Istilah IT baru, 3. Kenapa penting untuk engineer)* secara *on-demand* dan menyimpannya permanen ke `daily_digests.ai_summary`.

---

### Paket 3 → `docs/plans/08-voice-interview-ai-review.md`
**Fokus:** Simulasi wawancara lisan dengan Gemini Audio Multimodal & evaluasi gaya penyampaian.

1. **Migrasi & Kontrak Data:**
   - Migrasi `0008_interview_voice_review.sql`: tambah kolom nullable `transcript TEXT` dan `ai_feedback JSONB` pada tabel `interview_attempts` (tidak mengubah `interview_cards`).
   - Tambah `InterviewAiFeedbackSchema` di `src/types/schemas.ts`:
     - `transcript` (string, mendukung campuran ID + istilah teknis EN)
     - `content_review`: `{ definition_score (1-5), problem_score (1-5), tradeoffs_score (1-5), strengths[], missing_points[] }`
     - `delivery_review`: `{ clarity_score (1-5), structure_score (1-5), pacing_notes, filler_words: [{ word, count }], actionable_tips[] }`
     - `suggested_confidence`: `'confused' | 'partial' | 'ready'` + `confidence_reason`.
2. **Server-Side Multimodal Pipeline (Stateless & Tanpa Storage):**
   - Perluas tipis `src/lib/gemini.ts` agar `generateStructuredJson` menerima parameter opsional `inlineData?: { mimeType: string; dataBase64: string }`.
   - Deep module `src/services/ai/interview-reviewer.ts` + `interview-reviewer.test.ts` (seam *injected AI adapter*): validasi MIME (`audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`), validasi ukuran audio maks. **3.5 MB** (aman di bawah batas 4.5 MB Vercel Hobby), batas durasi minimal (>3 detik / tidak kosong), dan pemetaan prompt evaluasi isi + gaya penyampaian.
   - Route Handler tipis `POST /api/interview/review` (`maxDuration = 30`): menerima `FormData` (`audio`, `questionPrompt`, `skillName`, `durationSeconds`), verifikasi `requireAllowedUser`, konversi buffer ke Base64 *in-memory*, panggil `reviewVoiceInterview`, buang buffer audio, dan kembalikan JSON review (tanpa menulis DB).
3. **UI Recorder Terpisah & Integrasi `/interview`:**
   - Komponen baru `src/components/interview/VoiceInterviewRecorder.tsx`:
     - Menggunakan `MediaRecorder` (`audio/webm;codecs=opus`, fallback `audio/mp4` untuk Safari, `audioBitsPerSecond: 32000–48000`), sinkron dengan timer 2 menit (otomatis stop di 120 detik), indikator gelombang/status rekam, dan *preview playback* lokal sebelum kirim.
     - Fallback elegan bila izin mikrofon ditolak atau Gemini mengembalikan `429` (pengguna tetap bisa menyimpan catatan teks `<textarea>` tanpa kehilangan sesi).
   - Panel hasil review menampilkan transkrip, skor kerangka 3 poin, skor **Kejelasan** & **Struktur Alur**, lencana daftar ***Filler Words*** + jumlah kemunculan, serta rekomendasi `suggested_confidence` yang dikonfirmasi pengguna sebelum disimpan via `submitInterviewAttemptAction` (perluas action agar menerima `transcript?` & `aiFeedback?` opsional).

---

### Paket 4 → `docs/plans/09-ux-speed-and-portfolio-helper.md`
**Fokus:** Mempercepat navigasi harian dan mengubah hasil praktikum Capstone menjadi aset melamar magang.

1. **Route Loading Skeletons (`loading.tsx`):**
   - Tambahkan `src/app/(dashboard)/loading.tsx` serta skeleton spesifik untuk rute berat (`/dashboard/loading.tsx`, `/tracks/[id]/modules/[moduleId]/loading.tsx`, `/internships/[id]/loading.tsx`) dengan warna semantic token Light/Dark.
2. **Command Palette (`Ctrl+K` / `Cmd+K`):**
   - Komponen ringan `src/components/layout/CommandPalette.tsx` (berbasis `Dialog` `shadcn/ui` yang sudah ada, tanpa menambah library berat) + endpoint ringan atau data awal dari layout untuk loncat cepat ke halaman, `Skill`, `Note`, `TargetInternship`, atau istilah `JargonGlossary`.
3. **Capstone → Bullet CV ATS & Cerita STAR:**
   - Migrasi `0009_track_portfolio_summary.sql`: tambah kolom nullable `portfolio_summary JSONB` pada `learning_tracks`.
   - Deep module `src/services/ai/portfolio-summarizer.ts` + `portfolio-summarizer.test.ts` & Route Handler `POST /api/tracks/[id]/portfolio-summary` (`maxDuration = 30`, cache permanen di `learning_tracks.portfolio_summary`).
   - Tombol **"Generate Bullet CV & Cerita STAR"** di `/tracks/[id]` (aktif setelah minimal 1 modul berstatus `completed`), menghasilkan 3–4 *bullet point* CV ATS-friendly (ID & EN) + draf cerita STAR 90 detik lengkap dengan tombol salin 1-klik.

---

## 4. Instruksi Eksekusi untuk Antigravity (Mode Planning Saja)

Saat membaca file ini di sesi planning:

1. **Inspeksi Kode Aktual Terlebih Dahulu:** Baca `AGENTS.md`, `docs/PRD.md`, `docs/GLOSSARY.md`, `docs/DECISIONS.md`, `src/types/schemas.ts`, dan daftar migrasi di `supabase/migrations/` agar seluruh plan selaras 100% dengan kode yang sudah terpasang di repo.
2. **Perbarui Dokumen Sumber Kebenaran:**
   - Tambahkan `ADR-012` (Deep Study Guide & MCQ Quiz), `ADR-013` (Job Radar & Digest Upgrade), `ADR-014` (Voice Interview Gemini Audio Multimodal), dan `ADR-015` (UX Skeletons, Command Palette & Capstone CV Summarizer) ke `docs/DECISIONS.md`.
   - Perbarui `docs/PRD.md` (tambahkan bagian *v1.1 Extensions*) dan `docs/GLOSSARY.md` (tambahkan entitas/enum baru seperti `McqQuestion`, `'module_mcq'`, `'note_mcq'`, `JobRadarItem`, `InterviewAiFeedback`).
3. **Buat 4 File Plan di `docs/plans/`:**
   - `docs/plans/06-deep-modules-and-mcq-quiz.md`
   - `docs/plans/07-job-radar-and-it-news.md`
   - `docs/plans/08-voice-interview-ai-review.md`
   - `docs/plans/09-ux-speed-and-portfolio-helper.md`
4. **Format Wajib Setiap File Plan:**
   - Mengikuti persis format `docs/plans/01`–`05`: header fase & aturan *seam*, pecah menjadi 3–4 sub-step kecil (`Step X.1`, `Step X.2`, dst.) dengan `Blocked by`, daftar file pasti, tugas ber-checkbox, `Verification Checklist` (`tsc`, `lint`, `test`, `build`), saran *Conventional Commit* (untuk workflow 1 branch `main`), dan bagian `## Handoff Log` kosong di bawahnya.
5. **STOP Setelah Dokumen Selesai:** DILARANG menulis atau mengubah kode aplikasi (`src/`, `supabase/`) pada sesi planning ini. Tampilkan ringkasan dokumen yang dibuat/diubah agar pengguna dapat me-review dan meng-commit dokumen terlebih dahulu.