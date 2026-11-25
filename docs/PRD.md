# Product Requirements Document (PRD): DevPrep Hub — Spesifikasi Final

## 1. Ringkasan Produk, Problem Statement & Solution

### Problem Statement
**DevPrep Hub** (*Personal Engineering Readiness Hub*) menjawab empat kendala utama calon intern/engineer saat mempersiapkan diri memasuki industri:
* **Ketimpangan Materi vs Kebutuhan Magang:** Sulit memetakan mana fundamental dan *tech stack* yang benar-benar diprioritaskan lowongan magang dibandingkan keahlian yang sudah dikuasai.
* **Ketinggalan Istilah IT Baru:** Banyak istilah industri (seperti *idempotency*, *rate limiting*, *message broker*, *CI/CD*) muncul di deskripsi pekerjaan tetapi belum dipahami konteks maupun implementasinya.
* **Belajar Terlalu Teoretis & Terpecah:** Catatan tersebar tanpa *active recall*, sementara latihan coding terpecah menjadi proyek demo kecil yang tidak saling terhubung.
* **Kurang Latihan Komunikasi Teknis:** Memahami kode secara pasif tidak otomatis melatih kemampuan menjelaskan *trade-off* arsitektur secara terstruktur saat wawancara teknis.

### Solution
DevPrep Hub menyatukan pemetaan profil GitHub dan analisis lowongan magang (`TargetInternship`), kurasi bacaan harian (`DailyDigest`), kurikulum praktikum terpadu berbasis satu proyek utama (`One-App Capstone`), catatan Markdown dengan kuis *cloze* deterministik (`ClozeDeletion`), serta simulasi wawancara dengan *Spaced Repetition* (`InterviewCard` & `InterviewAttempt`) dalam satu aplikasi Next.js App Router + Supabase.

### Target & Batasan Utama
* **Target Pengguna & Isolasi Data:** Penggunaan pribadi melalui *Single-User Gate* (`ALLOWED_USER_EMAIL` + menonaktifkan *public signup* di Supabase Auth), dengan skema database siap diperluas ke *multi-user* melalui kolom `user_id` dan *Row Level Security* (RLS) penuh di seluruh tabel.
* **Arsitektur & Biaya:** Next.js Full-Stack (App Router) + Supabase (PostgreSQL & Auth) + Vercel Hobby, dirancang berjalan **100% pada Free Tier** melalui eksekusi AI 2-tahap (*blueprint* lalu *on-demand*), *caching* persisten di PostgreSQL (`JSONB`), dan Public APIs resmi tanpa biaya.
* **Sumber Kebenaran Istilah:** Seluruh penamaan tabel, tipe TypeScript, enum, API, dan UI wajib merujuk pada `docs/GLOSSARY.md`, sementara keputusan teknis merujuk pada `docs/DECISIONS.md` (`ADR-001`–`ADR-010`).

---

## 2. Alur Kerja Inti Aplikasi (Core User Loop)

1. **Input Target & Sinkronisasi Profil:** Pengguna melakukan *GitHub Sync* (maks. 20 repositori publik non-fork terbaru) untuk membangun daftar awal `Skill` (*baseline* `mastery_score = 40`), lalu memasukkan deskripsi lowongan magang (`TargetInternship`, maks. 15.000 karakter), daftar *skill* manual, atau profil *role* + industri.
2. **Analisis Gap & Glosarium:** Sistem mengekstrak *hard engineering skills* saja (`must_have` vs `nice_to_have`), menyusun `JargonGlossary`, melakukan deduplikasi 3 lapis ke master `skills`, dan menghitung `ReadinessMeter` berbobot `2:1`.
3. **Kurasi Materi & Generasi Capstone 2-Tahap:**
   - **Tahap 1 (Blueprint):** Pengguna membuat `LearningTrack` berisi arsitektur `One-App Capstone` (atau percabangan `microservice` / `language_native`) beserta kerangka daftar `TrackModule` berstatus `content_status = 'pending'`.
   - **Tahap 2 (On-Demand per Modul):** Saat suatu `TrackModule` dibuka pertama kali, sistem menjalankan `HybridSourcing` paralel (maks. 4 detik/sumber, cache 7 hari di `curated_resources`) lalu mengisi `concept_brief`, `warmup_drills`, dan `hands_on_ticket` secara permanen ke `JSONB` (`content_status = 'ready'`).
4. **Belajar Aktif & Praktikum:** Di halaman utama, blok `Today's Focus` mengarahkan prioritas harian. Pengguna membaca `DailyDigest` (1–2 artikel/hari), menyimpan konsep dari *Digest*, *Jargon Glossary*, maupun *Concept Brief* lewat *Save to Note* (otomatis tertaut `skill_id` dan menyisipkan `{{istilah}}`), berlatih kuis *cloze*, menyelesaikan `Warm-up Drill` (*inline blank*), dan menuntaskan `Hands-On Ticket`.
5. **Evaluasi & Simulasi Interview:** Pengguna mengirim potongan kode atau tautan *commit* GitHub sebagai `LabSubmission` (diff disaring dari *lockfile*/binary dan dipangkas maks. 12.000 karakter) untuk dievaluasi AI terhadap *Acceptance Criteria* sekaligus otomatis melahirkan 2 `InterviewCard` baru (`source = 'lab_review'`). Pengguna kemudian berlatih menjawab `InterviewCard` dengan timer 2 menit, merekam `InterviewAttempt`, memperbarui jadwal *Spaced Repetition*, dan memperbarui `MasteryScore` secara dinamis.

---

## 3. User Stories

1. Sebagai pemilik aplikasi, saya ingin akses login dibatasi oleh `ALLOWED_USER_EMAIL` dengan *public signup* nonaktif, agar kuota Gemini API pribadi saya tidak disalahgunakan pengguna luar meskipun aplikasi di-deploy di URL publik.
2. Sebagai pengguna baru, saya ingin menyinkronkan hingga 20 repositori publik non-fork terbaru dari GitHub, agar `Skill` yang sudah pernah saya gunakan langsung tercatat dengan *baseline* `mastery_score = 40` (`learning`).
3. Sebagai pengguna, saya ingin memasukkan teks lowongan magang (hingga 15.000 karakter), daftar *skill* manual, atau kombinasi peran dan industri, agar sistem memisahkan `must_have` dan `nice_to_have` sekaligus membuang *soft skills* HR yang tidak relevan.
4. Sebagai pengguna, saya ingin melihat `JargonGlossary` dari setiap lowongan yang dianalisis, agar istilah industri asing langsung terpahami konteks rekayasanya.
5. Sebagai pengguna, saya ingin nama *skill* yang bervariasi (seperti `Postgres` vs `PostgreSQL`, `JS` vs `JavaScript`, `C++` vs `C#`) otomatis terpetakan ke satu entri `Skill` kanonik, serta memiliki aksi *Merge Skill* manual jika tetap ditemukan duplikat, agar progres belajar selalu terpusat.
6. Sebagai pengguna, saya ingin melihat `ReadinessMeter` per lowongan yang memberi bobot 2x lebih tinggi pada `must_have` dibanding `nice_to_have` beserta pelacak status lamaran, agar saya bisa memprioritaskan lowongan dan *gap* terpenting.
7. Sebagai pengguna, saya ingin membuat `LearningTrack` berupa cetak biru `One-App Capstone` terlebih dahulu dan mengisi detail tiap `TrackModule` secara *on-demand* saat modul dibuka, agar proses generasi tidak terkena *timeout* Vercel maupun memboroskan kuota Gemini Free Tier.
8. Sebagai pengguna, saya ingin melihat tombol **"Coba Generate Ulang"** apabila generasi modul gagal atau terkena *rate limit* Gemini (`429`), tanpa kehilangan blueprint `LearningTrack` yang sudah dibuat.
9. Sebagai pengguna, saya ingin topik bahasa pemrograman baru menawarkan pilihan mode `microservice` (terhubung ke Capstone) atau `language_native`, agar latihan idiom bahasa tetap relevan.
10. Sebagai pengguna, saya ingin referensi `CuratedResource` ditarik paralel dari beberapa Public API resmi dengan batas waktu 4 detik per sumber dan di-cache 7 hari, agar kegagalan satu sumber eksternal tidak menggagalkan pembukaan modul.
11. Sebagai pengguna, saya ingin tombol 1-klik **Save to Note** tersedia di `DailyDigest`, `JargonGlossary`, dan `ConceptBrief` (otomatis tertaut ke `skill_id` dan berformat `{{istilah}}`), agar temuan belajar cepat masuk ke siklus *active recall*.
12. Sebagai pengguna, saya ingin menulis catatan Markdown pada editor `<textarea>` monospace yang ringan lengkap dengan tombol toolbar pembuat `{{...}}`, *live preview*, dan panel *Quick Lookup* Wikipedia/MDN/Stack Exchange.
13. Sebagai pengguna, saya ingin sintaks *cloze* `{{...}}` di dalam blok kode dan *inline code* diabaikan secara default (dan hanya aktif jika ditulis eksplisit `{{cloze:...}}`), agar contoh kode JSX, GitHub Actions, atau template tidak merusak kuis.
14. Sebagai pengguna, saya ingin mencetak catatan menjadi PDF 2 kolom rapi lewat tampilan **Export A4** (`@media print`), agar nyaman dibaca ulang secara luring.
15. Sebagai pengguna, saya ingin mengerjakan `Warm-up Drill` dalam tampilan kode *read-only* ber-*syntax highlight* dengan `<input>` *inline* yang bisa dilewati dengan tombol `Tab`, agar fokus mengisi sintaks tanpa merusak struktur kode.
16. Sebagai pengguna, saya ingin membuka `ProgressiveHints` 3 tingkat secara bertahap dan mengirimkan kode atau tautan *commit* GitHub sebagai `LabSubmission` untuk dicek terhadap *Acceptance Criteria* dan menghasilkan 2 `InterviewCard` baru.
17. Sebagai pengguna, saya ingin menerima 1–2 bacaan `DailyDigest` harian via Vercel Cron yang idempoten tanpa duplikasi artikel dan sekaligus menjaga proyek Supabase Free Tier tetap aktif.
18. Sebagai pengguna, saya ingin berlatih menjawab `InterviewCard` memakai timer 2 menit, kerangka 3 poin, dan penilaian mandiri (`confused`, `partial`, `ready`), agar setiap `InterviewAttempt` tercatat dan jadwal `next_review_at` diperbarui otomatis (+2/+5/+14 hari).
19. Sebagai pengguna, saya ingin melihat kartu `Today's Focus` dan skor `MasteryScore` (lengkap dengan rincian kontribusi Quiz/Lab/Interview atau *override* manual di `/skills`), agar saya langsung tahu langkah belajar paling bernilai setiap hari.

---

## 4. Kebutuhan Fungsional (Functional Requirements)

### Modul A: Autentikasi, Single-User Gate & Sinkronisasi GitHub
* **FR-A1:** Login dan proteksi seluruh rute aplikasi menggunakan Supabase Auth (Email/Password atau GitHub OAuth) melalui `src/proxy.ts` dan Server Guard. *Public signup* dinonaktifkan di Supabase Auth dan server menegakkan `ALLOWED_USER_EMAIL` sebagai *Single-User Gate* (mencegah pihak luar mengakses endpoint AI maupun data).
* **FR-A2:** Sinkronisasi repositori publik GitHub pengguna (via GitHub REST API, dibatasi **maks. 20 repo publik non-fork terbaru**) untuk membaca bahasa utama, `topics`, dan dependensi manifes guna mengisi master `skills` dengan *baseline* `mastery_score = 40` (`status = 'learning'`, `source = 'github'`).

### Modul B: Custom Internship Analyzer & Job Radar
* **FR-B1:** Formulir input `TargetInternship` mendukung 3 mode: *paste* teks JD utuh (**maks. 15.000 karakter**), input daftar *skill* manual, atau kombinasi peran + sektor industri.
* **FR-B2:** Ekstraksi JSON terstruktur via Gemini API: hanya mengambil **hard engineering skills** (secara eksplisit mengecualikan *soft skills* HR), memisahkan `must_have` vs `nice_to_have`, dan menyusun `JargonGlossary`.
* **FR-B3:** *Skill Deduplication* 3 lapis (`ADR-007`): normalizer deterministik simbol & kamus alias (`src/lib/skill-normalizer.ts`), injeksi daftar `Skill` eksisting pengguna ke prompt ekstraksi JD, serta fitur **Merge Skill** manual di `/skills` (via PostgreSQL RPC) untuk menggabungkan relasi duplikat secara atomik.
* **FR-B4:** Kalkulasi `ReadinessMeter` (`%`) per lowongan dengan bobot `must_have = 2` dan `nice_to_have = 1`, pelacak status lamaran (`preparing`, `applied`, `interview`, `offer`, `rejected`), serta tombol 1-klik **Save to Note** pada tiap entri `JargonGlossary`.
* **FR-B5 (Opsional/Fase Lanjut):** Radar lowongan *remote* global dari Arbeitnow / Remotive API untuk memantau tren teknologi industri.

### Modul C: Adaptive Learning Track & One-App Capstone
* **FR-C1:** Pembuatan `LearningTrack` dari satu `TargetInternship` atau daftar `Skill` pilihan menggunakan **pipeline 2-tahap (`ADR-006`)**:
  - `POST /api/tracks/generate` menghasilkan cetak biru `One-App Capstone` + kerangka berurutan `TrackModule` (`objective`, `module_type`, `target_language`, `content_status = 'pending'`).
  - `POST /api/tracks/[id]/modules/[moduleId]/generate` dijalankan *on-demand* saat pengguna membuka modul dengan `content_status !== 'ready'`, dengan batas *retry* maks. 1 kali dan tombol **"Coba Generate Ulang"** bila terkena *rate limit* (`429`).
* **FR-C2:** Klasifikasi tipe modul otomatis:
  - Konsep / Arsitektur / Framework / Tool → `capstone_feature` di dalam `One-App Capstone`.
  - Bahasa pemrograman baru → pengguna memilih `microservice` (1 layanan kecil berbahasa target yang terhubung ke Capstone) atau `language_native` (*mini-app* sesuai idiom bahasa target).
* **FR-C3:** Setiap `TrackModule` memiliki 4 komponen terstruktur:
  1. **Concept Brief & Glosarium:** Penjelasan ringkas, analogi, daftar `CuratedResource` hasil `HybridSourcing` (Dev.to, Stack Exchange, MDN/Wikipedia, YouTube opsional; paralel `Promise.allSettled`, timeout maks. 4 detik/sumber, cache 7 hari), serta tombol **Save to Note** untuk menyimpan intisari bertaut `skill_id`.
  2. **Warm-up Drill:** 3–5 soal kode *fill-in-the-blank* yang dirender sebagai blok kode *read-only* ber-*syntax highlight* ringan dengan `<input>` *inline* di setiap slot kosong (navigasi `Tab`, evaluasi instan).
  3. **Hands-On Ticket:** Konteks masalah, *Acceptance Criteria* terukur, dan `ProgressiveHints` 3 tingkat (arsitektur → *pseudocode* → contoh implementasi).
  4. **Code Submission & Review (`LabSubmission`):** Input potongan kode (`<textarea>` monospace) atau tautan *commit* GitHub; jika berupa URL *commit*, sistem menyaring *lockfile*/binary dan memangkas *diff* **maks. 12.000 karakter** sebelum dievaluasi Gemini terhadap *Acceptance Criteria*. Review yang berhasil menyimpan umpan balik terstruktur serta **otomatis menyisipkan 2 `InterviewCard` baru** (`source = 'lab_review'`, `lab_submission_id` terisi).

### Modul D: Daily Engineering Digest
* **FR-D1:** Penarikan otomatis 1–2 artikel teknis harian dari **Dev.to API** dan **Hacker News Firebase API** yang relevan dengan `Skill` berstatus `gap` atau `learning`.
* **FR-D2:** Eksekusi terjadwal 1x sehari via **Vercel Cron Job** (`/api/cron/daily-digest`) dengan validasi `Authorization: Bearer <CRON_SECRET>` dan jaminan idempotensi PostgreSQL (`UNIQUE (user_id, source, external_id)`), sekaligus menjaga Supabase Free Tier terhindar dari *auto-pause*.
* **FR-D3:** Aksi cepat pada tiap artikel: tandai sudah dibaca (`is_read`) atau konversi menjadi draf `Note` baru (**Save to Note**) bertaut `matched_skill_id`.

### Modul E: Smart Notes, Auto Cheat-Sheet & Active Recall Quiz
* **FR-E1:** Editor `Note` memakai `<textarea>` monospace terkontrol bertaut `skill_id`, dilengkapi toolbar penyisip `{{...}}`, *live preview* Markdown, dan panel **Quick Lookup** (Wikipedia, MDN, Stack Exchange).
* **FR-E2:** Parser `ClozeDeletion` deterministik di `src/lib/cloze-parser.ts` (`ADR-004`):
  - Pada teks Markdown biasa: mendeteksi `{{jawaban}}` dan `{{jawaban::petunjuk}}`, mendukung escape `\{\{...\}\}` untuk kurung literal.
  - Pada *fenced code block* (` ```...``` ` / `~~~...~~~`) dan *inline code* (`` `...` ``): mengabaikan `{{...}}` secara default agar sintaks JSX/CI/template aman, serta hanya mem-parse format opt-in eksplisit `{{cloze:jawaban}}` atau `{{cloze:jawaban::petunjuk}}`.
  - Menolak *cloze* kosong (`{{}}`) maupun *cloze* lintas baris (*multiline*), serta melakukan normalisasi spasi saat penilaian jawaban.
* **FR-E3:** Tampilan cetak **Export A4 Cheat-Sheet** (`/notes/[id]/print`) memakai `@media print` (tata letak 2 kolom, pemisahan halaman rapi, siap simpan ke PDF melalui *browser*).
* **FR-E4 (Opsional):** Ekspor atau *backup* potongan kode catatan ke **GitHub Gist API**.

### Modul F: Interview Lab, Mastery Score & Today's Focus
* **FR-F1:** Sesi latihan di `/interview` mengambil antrean `InterviewCard` yang berasal dari `lab_review`, `skill_gap`, atau input `manual` dengan urutan prioritas `next_review_at <= NOW()`.
* **FR-F2:** Sesi dilengkapi *countdown timer* (default 2 menit) dan kerangka jawaban 3 poin: *(1) Definisi, (2) Masalah yang diselesaikan, (3) Trade-off & batasan*.
* **FR-F3:** Setiap penyelesaian sesi menyisipkan 1 baris baru di `interview_attempts` (*append-only*) dan memperbarui `confidence_level` (`confused`, `partial`, `ready`), `review_count`, serta `next_review_at` (+2, +5, +14 hari) pada `interview_cards`.
* **FR-F4:** Perhitungan `MasteryScore` (`0–100`) di `src/lib/mastery.ts` (`ADR-008`):
  - Sinyal: **Quiz (`Q`, bobot 30)** = rata-rata 3 `quiz_attempts` terbaru; **Lab (`L`, bobot 40)** = `100` jika `passed = true` atau `50` jika sudah submit namun belum lulus; **Interview (`I`, bobot 30)** = skor sesi terbaru (`confused = 25`, `partial = 65`, `ready = 100`).
  - Agregasi: 0 sinyal = `40` untuk `source = 'github'` atau `0` untuk lainnya; tepat 1 sinyal aktif = *cap* maks. `65` (`max(40, skor)` jika dari GitHub); ≥2 sinyal aktif = bobot sinyal yang tersedia dinormalisasi ulang menjadi `100%`.
  - `skills.status` otomatis diturunkan dari `mastery_score` (`0–29 = gap`, `30–79 = learning`, `80–100 = mastered`); pengguna juga dapat melakukan *override* manual di `/skills`.
* **FR-F5:** Dashboard (`/dashboard`) menampilkan kartu **Today's Focus** secara deterministik tanpa panggilan LLM *(1. `InterviewCard` jatuh tempo hari ini → 2. `DailyDigest` belum dibaca → 3. `TrackModule` berstatus `in_progress`)* beserta grafik progres `MasteryScore`, tren `QuizAttempt`, *learning streak*, dan `ReadinessMeter` target magang teratas.

---

## 5. Kebutuhan Non-Fungsional & Implementation Decisions

### Tech Stack Terkunci
* **Framework:** Next.js `16.4.6` (App Router, TypeScript, menggunakan `src/proxy.ts` sesuai konvensi Next.js 16 — bukan konvensi middleware lama).
* **Styling & UI:** Tailwind CSS v4 + `shadcn/ui` (Radix UI primitives, `class-variance-authority`, `clsx`, `tailwind-merge` via `src/lib/utils.ts`, konfigurasi `components.json`), ikon Lucide, editor ringan tanpa Monaco/CodeMirror (`ADR-009`), serta *syntax highlighter* ringan untuk blok kode *read-only* `Warm-up Drill`.
* **Database, Auth & Types:** Supabase (PostgreSQL + Supabase Auth + RLS penuh di seluruh tabel), akses melalui `@supabase/supabase-js` + `@supabase/ssr`, migrasi SQL terversi di `supabase/migrations/*.sql`, *generated TypeScript types* di `src/types/database.ts`, serta PostgreSQL RPC untuk transaksi atomik lintas tabel (`ADR-005`).
* **Validasi & AI Engine:** Zod untuk validasi payload input, output JSON Gemini, dan seluruh kolom `JSONB`; Google Gemini API Free Tier dengan *Structured JSON Output*.
* **Deployment & Cron:** Vercel Hobby Plan (`maxDuration = 30` pada Route Handler AI) + Vercel Cron Jobs.

### Rujukan Keputusan Arsitektur
Detail konteks dan konsekuensi seluruh keputusan teknis tercatat pada `docs/DECISIONS.md` (`ADR-001` s.d. `ADR-010`).

### Keamanan, Batasan Free Tier & Environment Variables
* Seluruh secret hanya diakses di sisi server (Route Handlers, Server Actions, `src/services/`) dan wajib terdaftar kosong di `.env.example`:
  - `NEXT_PUBLIC_SUPABASE_URL` *(publik)*
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(publik)*
  - `SUPABASE_SERVICE_ROLE_KEY` *(server-only, khusus `/api/cron/daily-digest`)*
  - `GEMINI_API_KEY` *(server-only)*
  - `GITHUB_TOKEN` *(server-only)*
  - `CRON_SECRET` *(server-only)*
  - `ALLOWED_USER_EMAIL` *(server-only, Single-User Gate)*
* `HybridSourcing` wajib memakai `Promise.allSettled` dengan *timeout* maks. 4 detik per sumber (`AbortSignal.timeout(4000)`).
* Seluruh halaman baca hanya membaca data ter-cache di PostgreSQL dan tidak pernah memanggil Gemini API atau Public API secara langsung.

---

## 6. Rancangan Database (Supabase / PostgreSQL)

### Hubungan Entitas Utama
```text
auth.users (1) ── (1) profiles
profiles (1) ── (N) skills
profiles (1) ── (N) target_internships
target_internships (N) ── (N) skills              [via internship_skills]
skills (1) ── (N) curated_resources
skills (1) ── (N) notes
skills (1) ── (N) quiz_attempts
skills (1) ── (N) daily_digests
skills (1) ── (N) interview_cards
target_internships (1) ── (N) learning_tracks     [nullable]
learning_tracks (1) ── (N) track_modules
track_modules (N) ── (1) skills
track_modules (1) ── (N) lab_submissions
lab_submissions (1) ── (N) interview_cards        [nullable]
interview_cards (1) ── (N) interview_attempts
```

### Detail Tabel & Index

| Tabel | Kolom Utama & Tipe Data | Keterangan & Index |
| :--- | :--- | :--- |
| **`profiles`** | `id (UUID PK, FK auth.users)`, `full_name (TEXT)`, `github_username (TEXT)`, `last_github_sync (TIMESTAMPTZ)`, `created_at` | Menyimpan profil & metadata sinkronisasi GitHub. |
| **`skills`** | `id (UUID PK)`, `user_id (UUID FK)`, `name (TEXT)`, `slug (TEXT)`, `category (ENUM: language, framework, concept, tool)`, `status (ENUM: gap, learning, mastered)`, `mastery_score (INT 0-100)`, `source (ENUM: github, jd, manual)`, `updated_at` | **Unique index:** `(user_id, slug)`. Pusat deduplikasi seluruh modul (*hard engineering skills only*). |
| **`target_internships`** | `id (UUID PK)`, `user_id (UUID FK)`, `title (TEXT)`, `company_name (TEXT)`, `industry (TEXT)`, `raw_input (TEXT)`, `jargon_glossary (JSONB)`, `status (ENUM: preparing, applied, interview, offer, rejected)`, `created_at` | `jargon_glossary`: array `{ term, definition, context }`. |
| **`internship_skills`** | `internship_id (UUID FK)`, `skill_id (UUID FK)`, `priority (ENUM: must_have, nice_to_have)` | **Composite PK:** `(internship_id, skill_id)`. |
| **`curated_resources`** | `id (UUID PK)`, `skill_id (UUID FK)`, `source (ENUM: devto, stackoverflow, mdn, wikipedia, youtube, github)`, `title (TEXT)`, `url (TEXT)`, `summary (TEXT)`, `fetched_at (TIMESTAMPTZ)` | **Unique index:** `(skill_id, url)`. Cache 7 hari hasil `HybridSourcing`. |
| **`learning_tracks`** | `id (UUID PK)`, `user_id (UUID FK)`, `internship_id (UUID FK nullable)`, `capstone_title (TEXT)`, `capstone_description (TEXT)`, `primary_stack (TEXT)`, `architecture_overview (TEXT)`, `status (ENUM: active, completed, archived)`, `created_at` | Cetak biru 1 aplikasi utama (`One-App Capstone`). |
| **`track_modules`** | `id (UUID PK)`, `track_id (UUID FK)`, `skill_id (UUID FK)`, `order_index (INT)`, `module_type (ENUM: capstone_feature, microservice, language_native)`, `target_language (TEXT)`, `objective (TEXT)`, `content_status (ENUM: pending, ready, failed)`, `concept_brief (JSONB nullable)`, `warmup_drills (JSONB nullable)`, `hands_on_ticket (JSONB nullable)`, `status (ENUM: locked, in_progress, completed)` | Memisahkan `content_status` (generasi AI *on-demand*) dari `status` progres belajar. |
| **`lab_submissions`** | `id (UUID PK)`, `module_id (UUID FK)`, `user_id (UUID FK)`, `code_snippet (TEXT)`, `repo_commit_url (TEXT)`, `ai_review_feedback (JSONB)`, `generated_interview_qs (JSONB)`, `passed (BOOLEAN)`, `submitted_at (TIMESTAMPTZ)` | `ai_review_feedback`: `{ criteria_met[], improvements[], summary }`. |
| **`daily_digests`** | `id (UUID PK)`, `user_id (UUID FK)`, `source (ENUM: devto, hackernews)`, `external_id (TEXT)`, `title (TEXT)`, `url (TEXT)`, `tags (TEXT[])`, `matched_skill_id (UUID FK nullable)`, `is_read (BOOLEAN)`, `digest_date (DATE)` | **Unique index:** `(user_id, source, external_id)`. **Index:** `(user_id, digest_date DESC)`. Diisi oleh Vercel Cron harian. |
| **`notes`** | `id (UUID PK)`, `user_id (UUID FK)`, `skill_id (UUID FK nullable)`, `title (TEXT)`, `content_md (TEXT)`, `gist_id (TEXT nullable)`, `updated_at (TIMESTAMPTZ)` | Mendukung `{{...}}` & `{{cloze:...}}` untuk kuis *cloze*. |
| **`quiz_attempts`** | `id (UUID PK)`, `user_id (UUID FK)`, `skill_id (UUID FK)`, `source_type (ENUM: note_cloze, module_drill)`, `score (INT)`, `total_questions (INT)`, `correct_answers (INT)`, `attempted_at (TIMESTAMPTZ)` | Digunakan untuk menghitung `MasteryScore` & grafik progres. |
| **`interview_cards`** | `id (UUID PK)`, `user_id (UUID FK)`, `skill_id (UUID FK)`, `lab_submission_id (UUID FK nullable)`, `question_prompt (TEXT)`, `source (ENUM: lab_review, skill_gap, manual)`, `confidence_level (ENUM: confused, partial, ready nullable)`, `review_count (INT DEFAULT 0)`, `next_review_at (TIMESTAMPTZ DEFAULT NOW())`, `created_at`, `updated_at` | **Index:** `(user_id, next_review_at ASC)`, `(user_id, skill_id)`. Memegang tepat 1 jadwal *Spaced Repetition* aktif per pertanyaan. |
| **`interview_attempts`** | `id (UUID PK)`, `card_id (UUID FK)`, `user_id (UUID FK)`, `skill_id (UUID FK)`, `user_notes (TEXT)`, `duration_seconds (INT)`, `confidence_level (ENUM: confused, partial, ready)`, `attempted_at (TIMESTAMPTZ)` | **Index:** `(user_id, attempted_at DESC)`, `(card_id, attempted_at DESC)`. Log riwayat sesi *append-only*. |

### Kebijakan RLS & PostgreSQL RPC
* **RLS Penuh:** Seluruh tabel mengaktifkan `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` dengan policy kepemilikan `auth.uid() = user_id` (atau verifikasi melalui parent `learning_tracks` / `target_internships` / `skills` milik `auth.uid()`).
* **PostgreSQL Functions (RPC):**
  - `save_internship_analysis(...)` untuk menyimpan `target_internships`, *upsert* `skills`, dan memetakan `internship_skills` secara atomik dalam satu transaksi.
  - `merge_skills(source_skill_id, target_skill_id)` untuk memindahkan seluruh relasi (`internship_skills`, `curated_resources`, `notes`, `quiz_attempts`, `daily_digests`, `track_modules`, `interview_cards`, `interview_attempts`) dari skill duplikat ke skill kanonik lalu menghapus skill sumber.

---

## 7. Integrasi API & Internal Endpoints

### Eksternal API
| API | Fungsi | Strategi Cache / Batasan |
| :--- | :--- | :--- |
| **GitHub REST API** | Membaca maks. 20 repo publik non-fork terbaru (+ diff commit untuk *Lab Review* & opsional Gist backup). | Manual trigger *sync* (simpan `last_github_sync`); filter lockfile/binary & pangkas diff maks. 12.000 karakter. |
| **Dev.to API** | Menarik artikel untuk `DailyDigest` & pencarian materi per tag `Skill`. | Cache harian di `daily_digests` & 7 hari di `curated_resources` (timeout 4 detik). |
| **Hacker News Firebase API** | Menarik *top engineering stories* harian untuk `DailyDigest`. | Cache harian via Vercel Cron (timeout 4 detik). |
| **Stack Exchange API** | Mengambil pertanyaan *top-voted* untuk *common pitfalls* & *Quick Lookup*. | Cache 7 hari di `curated_resources` (timeout 4 detik). |
| **Wikipedia REST / MDN** | Definisi konsep fundamental untuk `HybridSourcing` & *Quick Lookup* catatan. | Cache 7 hari di `curated_resources` / fetch cache (timeout 4 detik). |
| **Gemini API (Free Tier)** | Ekstraksi JD & glosarium, blueprint Track, detail `TrackModule` *on-demand*, & *Lab Review*. | *Structured Output* (JSON Schema + Zod), `maxDuration = 30`, maks. 1 retry ringan, cache permanen di Supabase. |

### Internal Route Handlers (`src/app/api/*`)
* `POST /api/github/sync` — Sinkronisasi maks. 20 repositori publik non-fork terbaru GitHub ke master `skills` (*baseline* `40`).
* `POST /api/internships/analyze` — Validasi input JD (maks. 15.000 karakter), ekstraksi *hard skills only* + `JargonGlossary` via Gemini dengan injeksi daftar `Skill` eksisting, simpan atomik ke DB (**tanpa** menunggu *Hybrid Sourcing*).
* `POST /api/tracks/generate` — Menghasilkan blueprint `learning_tracks` & daftar kerangka `track_modules` (`content_status = 'pending'`).
* `POST /api/tracks/[id]/modules/[moduleId]/generate` — Mengisi detail 1 `TrackModule` secara *on-demand*: jalankan `HybridSourcing` paralel (timeout 4 detik/sumber, cache 7 hari) + 1 panggilan Gemini terfokus, lalu simpan permanen ke `JSONB` (`content_status = 'ready'`).
* `POST /api/labs/review` — Menyaring & memangkas *diff* commit (maks. 12.000 karakter) atau potongan kode, mengevaluasi `lab_submissions` terhadap *Acceptance Criteria*, serta menyisipkan 2 `interview_cards` baru.
* `GET /api/resources/lookup?q=...` — Pencarian cepat ke Wikipedia/MDN/Stack Exchange dari editor catatan (timeout 4 detik/sumber).
* `GET /api/cron/daily-digest` — Endpoint terjadwal harian terproteksi `Authorization: Bearer <CRON_SECRET>` menggunakan `SUPABASE_SERVICE_ROLE_KEY` untuk mengisi `daily_digests` secara idempoten.

---

## 8. Arsitektur Halaman & Struktur Direktori

### Peta Routing (`src/app/*`)
| Route | Tipe | Fungsi Utama |
| :--- | :--- | :--- |
| `/login` | Public | Halaman autentikasi Supabase Auth (*Single-User Gate*). |
| `/dashboard` | Protected | Ringkasan harian: kartu `Today's Focus`, grafik `MasteryScore`, ringkasan progres `One-App Capstone`, dan `ReadinessMeter` target teratas. |
| `/internships` | Protected | Daftar `TargetInternship` beserta `ReadinessMeter`, filter status lamaran, dan tombol **+ Analisis Lowongan Baru**. |
| `/internships/[id]` | Protected | Detail JD, `JargonGlossary` (+ tombol **Save to Note**), matriks *skill* (`must_have`/`nice_to_have`), dan tombol **Generate Capstone Track**. |
| `/tracks` | Protected | Daftar `LearningTrack` (*One-App Capstone* & *Language Track*) yang sedang aktif atau selesai. |
| `/tracks/[id]` | Protected | Cetak biru arsitektur Capstone dan peta urutan `TrackModule` (`status` progres & `content_status`). |
| `/tracks/[id]/modules/[moduleId]` | Protected | *Workspace* praktikum 4 tab (`Concept Brief` + **Save to Note**, `Warm-up Drill` *inline blank*, `Hands-On Ticket` + `ProgressiveHints`, dan `Code Review`) dengan *on-demand generation* & tombol *Coba Generate Ulang*. |
| `/digest` | Protected | Arsip `DailyDigest` harian dengan filter per `Skill` dan tombol **Save to Note**. |
| `/notes` | Protected | Daftar `Note` & *cheat-sheet* dikelompokkan berdasarkan `Skill`. |
| `/notes/[id]` | Protected | Editor `<textarea>` monospace + toolbar Cloze + *live preview* + panel *Quick Lookup* + tombol **Mulai Kuis Cloze** & **Export A4**. |
| `/notes/[id]/print` | Protected | Tampilan khusus siap cetak A4 (2 kolom, tanpa *sidebar/navbar*). |
| `/quiz` | Protected | Mode kuis *fill-in-the-blank* (dari `Note` `{{...}}` atau `Warm-up Drill`) lengkap dengan riwayat `QuizAttempt`. |
| `/interview` | Protected | *Interview Lab*: antrean `InterviewCard` jatuh tempo, timer 2 menit, kerangka 3 poin, input `InterviewAttempt`, dan pembaruan jadwal *Spaced Repetition*. |
| `/skills` | Protected | Direktori Master `Skill` dengan skor `MasteryScore` (tooltip rincian Q/L/I), *override* manual, tombol *Sync GitHub*, dan fitur **Merge Skill**. |

### Struktur Direktori Proyek
```text
dev-prep-hub/
├── supabase/
│   └── migrations/                 # Migrasi SQL terversi (tabel, index, RLS, RPC)
├── src/
│   ├── proxy.ts                    # Refresh sesi Supabase & proteksi route (Next.js 16)
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Shell utama (Sidebar, Header, Auth + Allowed Email Guard)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── internships/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── tracks/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── modules/[moduleId]/page.tsx
│   │   │   ├── digest/page.tsx
│   │   │   ├── notes/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── print/page.tsx
│   │   │   ├── quiz/page.tsx
│   │   │   ├── interview/page.tsx
│   │   │   └── skills/page.tsx
│   │   ├── api/
│   │   │   ├── cron/daily-digest/route.ts
│   │   │   ├── github/sync/route.ts
│   │   │   ├── internships/analyze/route.ts
│   │   │   ├── tracks/
│   │   │   │   ├── generate/route.ts
│   │   │   │   └── [id]/modules/[moduleId]/generate/route.ts
│   │   │   ├── labs/review/route.ts
│   │   │   └── resources/lookup/route.ts
│   │   ├── globals.css             # Termasuk aturan @media print A4
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                     # Komponen shadcn/ui (button, card, badge, dialog, tabs, input, textarea, select, sheet, tooltip, progress, separator)
│   │   ├── layout/                 # Sidebar, MobileNav, PageHeader
│   │   ├── dashboard/              # TodaysFocusCard, ReadinessOverview, MasteryChart
│   │   ├── internships/            # JDAnalyzerForm, ReadinessCard, JargonList
│   │   ├── tracks/                 # ModuleTabs, InlineBlankDrillRunner, ProgressiveHints, CodeReviewPanel
│   │   ├── notes/                  # MarkdownEditor, QuickLookupDrawer, A4PrintView
│   │   ├── quiz/                   # ClozeQuizRunner
│   │   ├── skills/                 # SkillTable, MergeSkillDialog
│   │   └── interview/              # InterviewTimer, SpacedRepetitionQueue
│   ├── lib/
│   │   ├── supabase/               # server.ts, client.ts, proxy.ts
│   │   ├── utils.ts                # Helper cn() untuk komponen shadcn/ui
│   │   ├── gemini.ts               # Client Gemini + Structured Output helpers
│   │   ├── skill-normalizer.ts     # Canonicalizer simbol & kamus alias skill
│   │   ├── cloze-parser.ts         # State-aware parser {{...}} & {{cloze:...}}
│   │   ├── spaced-repetition.ts    # Kalkulasi jadwal next_review_at (+2/+5/+14)
│   │   ├── mastery.ts              # Formula mastery_score, status, & Readiness Meter
│   │   └── diff-sanitizer.ts       # Filter lockfile/binary & pemangkas payload
│   ├── services/
│   │   ├── external/               # devto.ts, hackernews.ts, stackexchange.ts, wikipedia.ts, github.ts
│   │   └── ai/                     # jd-analyzer.ts, track-generator.ts, module-generator.ts, code-reviewer.ts
│   ├── actions/                    # Next.js Server Actions untuk mutasi CRUD terproteksi RLS
│   └── types/
│       ├── database.ts             # Generated Supabase TypeScript types
│       └── schemas.ts              # Zod schemas untuk validasi input & JSONB
├── components.json                 # Konfigurasi CLI shadcn/ui (Tailwind v4, alias @/*)
├── vercel.json                     # Konfigurasi Vercel Cron harian
└── .env.example                    # Template variabel lingkungan (tanpa nilai rahasia)
```

---

## 9. Roadmap Pengembangan (Vertical Slices)

1. **Fase 1 — Fondasi, Auth & Siklus Belajar Inti:**
   Setup migrasi SQL awal + RLS penuh di `supabase/migrations/`, `src/proxy.ts`, *Single-User Gate* (`ALLOWED_USER_EMAIL`), generated types, Master `skills`, CRUD `notes` Markdown (`<textarea>` + toolbar Cloze + *live preview*), parser *cloze* `{{...}}` / `{{cloze:...}}` dengan unit test (`tdd`), `quiz_attempts`, serta tampilan **Export A4**.
2. **Fase 2 — Internship Analyzer, Deduplikasi & Sourcing:**
   Input JD (maks. 15.000 karakter, *hard skills only*) + `JargonGlossary`, deduplikasi 3 lapis (`skill-normalizer` + injeksi prompt + RPC *Merge Skill*), `ReadinessMeter` (bobot `2:1`), *GitHub Sync* (maks. 20 repo non-fork, *baseline* `40`), *Quick Lookup*, *Save to Note* dari *Jargon Glossary*, serta `DailyDigest` via Vercel Cron idempoten.
3. **Fase 3 — One-App Capstone 2-Tahap & Hands-On Lab:**
   Generator blueprint `learning_tracks` + kerangka `track_modules`, endpoint *on-demand* `POST /api/tracks/[id]/modules/[moduleId]/generate` + `HybridSourcing` (timeout 4 detik, cache 7 hari) + tombol *Coba Generate Ulang*, UI 4 tab modul, *Save to Note* dari `ConceptBrief`, `Warm-up Drill` *inline blank*, `ProgressiveHints`, dan `LabSubmission` (filter lockfile/binary + cap 12.000 karakter) yang otomatis menyisipkan 2 `interview_cards`.
4. **Fase 4 — Interview Lab, Mastery Dinamis & Today's Focus:**
   *Interview Lab* (`interview_cards` + `interview_attempts` dengan timer 2 menit & kerangka 3 poin), *Spaced Repetition* (+2/+5/+14 hari), kalkulasi `MasteryScore` dinamis (`ADR-008`) beserta rincian Q/L/I, kartu `Today's Focus` deterministik, dan analitik `/dashboard`.

---

## 10. Strategi Pengujian & Testing Seams

Pengujian berfokus pada **perilaku eksternal (*external behavior*)** di batas modul (*seams*) berikut, bukan detail implementasi internal:

1. **Pure Domain Seams (Unit Test Deterministik / `tdd`):**
   - `src/lib/cloze-parser.ts`: menguji parsing `{{jawaban}}`, `{{jawaban::petunjuk}}`, escape `\{\{...\}\}`, penolakan `{{}}`/multiline, pengabaian `{{...}}` di dalam *fenced code block* dan *inline code*, serta opt-in eksplisit `{{cloze:...}}`.
   - `src/lib/skill-normalizer.ts`: menguji resolusi simbol (`C++`, `C#`, `.NET`, `Next.js`) dan pemetaan alias (`Postgres` → `PostgreSQL`, `JS` → `JavaScript`).
   - `src/lib/mastery.ts`: menguji *table-driven cases* untuk 0 sinyal (*baseline* `40` GitHub vs `0`), 1 sinyal (*cap* `65`), ≥2 sinyal (renormalisasi bobot `30/40/30`), derivasi `skills.status`, serta `ReadinessMeter` (`2:1`).
   - `src/lib/spaced-repetition.ts` & `src/lib/diff-sanitizer.ts`: menguji penambahan interval (+2/+5/+14 hari), penyaringan *lockfile*/binary, dan pemangkasan *diff* maksimal 12.000 karakter.
2. **Schema Contract Seams:**
   - Skema Zod untuk output ekstraksi JD (termasuk penolakan payload melebihi 15.000 karakter), blueprint Track, detail `TrackModule` (`concept_brief`, `warmup_drills`, `hands_on_ticket`), dan `ai_review_feedback` sebelum disimpan ke `JSONB`.
3. **Integration & API / DB Seams:**
   - **Auth & Gate:** permintaan tanpa sesi atau email selain `ALLOWED_USER_EMAIL` ditolak di layer proxy/server.
   - **Cron & Idempotensi:** `/api/cron/daily-digest` menolak header tanpa `CRON_SECRET` yang sah, dan pemanggilan ulang di hari yang sama tidak menggandakan baris `daily_digests`.
   - **Hybrid Sourcing Resilience:** memverifikasi `Promise.allSettled` tetap menghasilkan sumber dari API yang sehat apabila salah satu API eksternal timeout (>4 detik) atau mengembalikan error `500`.
   - **Database RLS & RPC:** memverifikasi isolasi antar `user_id` via RLS serta atomisitas `merge_skills` dan `save_internship_analysis`.

---

## 11. Di Luar Cakupan (Out of Scope)

Untuk menjaga fokus dan keandalan 100% Free Tier, hal-hal berikut secara eksplisit berada **di luar cakupan**:
* Penggunaan Prisma ORM atau lapisan ORM eksternal di luar `@supabase/supabase-js` + migrasi SQL.
* Penyematan editor kode berat (Monaco/CodeMirror) maupun *in-browser code execution sandbox* / container runner (kode Capstone ditulis di IDE lokal).
* Pencarian berbasis *vector embeddings* (`pgvector`) atau *background job queue* berbayar (seperti Inngest/Trigger.dev/Redis terpisah).
* *Web scraping* HTML di luar Public API resmi yang telah ditetapkan.
* Sistem *multi-tenant* dengan alur *public registration*, manajemen tim, atau pembayaran (*billing*).
