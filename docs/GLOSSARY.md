# Domain Glossary — DevPrep Hub

DevPrep Hub adalah *Personal Engineering Readiness Hub* yang membantu developer memetakan kesenjangan keahlian terhadap target magang, mempelajarinya lewat proyek *capstone* terstruktur, dan melatih *active recall* serta wawancara teknis. Dokumen ini menjadi sumber kebenaran tunggal untuk penamaan entitas, relasi, invariant, dan nilai enum di seluruh database, TypeScript, API, dan UI.

---

## Bahasa Domain (Core Domain Language)

### 1. Profil & Keahlian

**Profile**:
Representasi identitas pengguna beserta tautan akun GitHub dan jejak waktu sinkronisasi repositori terakhir.
_Avoid_: Account, Member, User Profile

**Skill**:
Keahlian teknis terukur (*hard engineering skill* berupa bahasa pemrograman, *framework*, konsep rekayasa perangkat lunak, atau *tool*) yang dinormalisasi per pengguna; *soft skills* HR dikecualikan.
_Avoid_: Tag, Tech, Topic, Competency

**Mastery Score**:
Angka penguasaan terukur bernilai `0–100` pada satu `Skill` yang dihitung dari kombinasi aktivitas kuis, praktikum lab, dan latihan wawancara.
_Avoid_: Proficiency, Skill Level, Rating

**Skill Status**:
Kategori tingkat kesiapan suatu `Skill` (`gap`, `learning`, atau `mastered`) yang diturunkan secara konsisten dari `Mastery Score`.
_Avoid_: Stage, Tier, Progress State

---

### 2. Analisis Magang

**Target Internship**:
Lowongan kerja magang atau profil peran dan sektor industri yang dianalisis kebutuhan keahliannya serta dilacak status lamarannya.
_Avoid_: Job Posting, Vacancy, Application

**Readiness Meter**:
Persentase kesiapan (`0–100%`) pengguna terhadap satu `Target Internship` berdasarkan rata-rata tertimbang `Mastery Score` seluruh keahlian terkait.
_Avoid_: Match Score, Fit Percentage, Compatibility Score

**Jargon Glossary**:
Kumpulan istilah industri atau istilah rekayasa spesifik yang muncul di deskripsi `Target Internship` lengkap dengan definisi ringkas dan konteks penggunaannya.
_Avoid_: Tech Dictionary, Term List, Vocabulary

---

### 3. Kurasi & Praktikum Capstone

**Curated Resource**:
Referensi belajar eksternal terverifikasi yang diambil dari sumber publik resmi dan disimpan permanen per `Skill`.
_Avoid_: Bookmark, Scraped Link, External Article

**Hybrid Sourcing**:
Mekanisme agregasi referensi teknis paralel dari berbagai sumber publik resmi secara bersamaan dengan batas waktu ketat per sumber.
_Avoid_: Web Scraping, Crawling

**Learning Track**:
Kurikulum belajar terstruktur yang menyatukan prioritas `Skill` berstatus `gap` atau `learning` menjadi rangkaian unit praktikum terurut.
_Avoid_: Course, Playlist, Roadmap

**One-App Capstone**:
Satu proyek aplikasi utama yang menjadi wadah integrasi bertahap berbagai fitur dari satu `Learning Track` agar pembelajaran tidak terpecah menjadi demo kecil yang terisolasi.
_Avoid_: Toy Project, Side Project, Sample App

**Track Module**:
Satu unit pembelajaran untuk satu `Skill` di dalam `Learning Track` yang memisahkan status progres belajar (`locked`, `in_progress`, `completed`) dari status kesiapan isi modulnya (`pending`, `ready`, `failed`).
_Avoid_: Lesson, Chapter, Unit

**Warm-up Drill**:
Latihan kode singkat berformat isian rumpang (*fill-in-the-blank*) pada satu `Track Module` untuk membiasakan sintaks dan pola sebelum mengerjakan tugas implementasi utama.
_Avoid_: Code Quiz, Mini Exercise, Coding Test

**Hands-On Ticket**:
Spesifikasi tugas implementasi nyata pada satu `Track Module` yang memuat konteks masalah dan *Acceptance Criteria* terukur.
_Avoid_: Homework, Assignment, Task Card

**Progressive Hints**:
Petunjuk bertahap tiga tingkat pada satu `Hands-On Ticket`—mulai dari panduan arsitektur, *pseudocode*, hingga contoh implementasi—agar pengguna dapat membuka bantuan sesuai kebutuhan.
_Avoid_: Solution Key, Cheat Answer

**Lab Submission**:
Kiriman potongan kode atau tautan *commit* repositori dari pengguna untuk dievaluasi terhadap *Acceptance Criteria* milik satu `Track Module`.
_Avoid_: Pull Request, Code Upload, Deliverable

---

### 4. Catatan & Active Recall

**Daily Digest**:
Kurasi bacaan teknis harian (1–2 artikel terpilih) yang dicocokkan dengan `Skill` berstatus `gap` atau `learning` milik pengguna.
_Avoid_: Newsfeed, Article Stream, Newsletter

**Note**:
Catatan ringkasan atau *cheat-sheet* Markdown pribadi yang dapat ditautkan ke satu `Skill` dan siap dicetak dalam format A4.
_Avoid_: Flashcard Deck, Wiki Page, Doc

**Cloze Deletion**:
Penandaan bagian penting di dalam teks `Note` menggunakan sintaks khusus untuk membangkitkan soal *fill-in-the-blank* secara deterministik tanpa mengorbankan keutuhan blok kode.
_Avoid_: Blank Mask, Hidden Text

**Quiz Attempt**:
Rekaman hasil pengerjaan satu sesi kuis—baik yang bersumber dari `Cloze Deletion` pada `Note` maupun dari `Warm-up Drill` pada `Track Module`.
_Avoid_: Exam Result, Test Log, Score Entry

---

### 5. Simulasi Interview & Fokus Harian

**Interview Card**:
Satu butir pertanyaan wawancara teknis (berasal dari hasil evaluasi `Lab Submission`, topik `Skill` berstatus `gap`, atau input manual) yang menyimpan jadwal pengulangan berkala aktif.
_Avoid_: Interview Log, Prompt Item, Question Bank Entry

**Interview Attempt**:
Catatan historis satu sesi latihan menjawab satu `Interview Card` yang merekam durasi, catatan kerangka 3 poin pengguna, dan tingkat kepercayaan diri saat sesi tersebut.
_Avoid_: Mock Session, Practice Log, Interview Record

**Today's Focus**:
Ringkasan prioritas aksi harian yang ditentukan secara deterministik di halaman utama berdasarkan `Interview Card` jatuh tempo, `Daily Digest` belum dibaca, dan `Track Module` yang sedang aktif.
_Avoid_: Todo List, Task Queue, Recommendation Feed

---

### 6. Ekstensi v1.1 (Deep Modules, MCQ, Job Radar, Voice & Portfolio)

**Deep Study Guide**:
Format materi `concept_brief` v2 yang terdiri atas 5 blok pedagogis berbahasa Indonesia (*Masalah Dunia Nyata*, *Analogi & Alur Kerja*, *Before vs After*, *Trade-off*, dan *Common Pitfalls*) serta tetap *backward-compatible* dengan format ringkas v1.
_Avoid_: Lecture Notes, E-Book Content

**Module Tutor**:
Asisten tanya-jawab *stateless* berbasis konteks `concept_brief` satu `Track Module` (maks. 500 karakter per pertanyaan, tanpa penyimpanan riwayat percakapan di database).
_Avoid_: Chatbot, Persistent AI Chat

**MCQ Question**:
Soal kartu pilihan ganda 4 opsi (`A`, `B`, `C`, `D`) lengkap dengan kunci jawaban dan pembahasan mengapa opsi benar tepat serta mengapa distraktor keliru, di-cache permanen pada `Track Module` atau `Note`.
_Avoid_: Multiple Choice Test, Trivia Card

**Job Radar Item**:
Entri lowongan magang atau *entry-level* terbuka yang ditarik dari Public API resmi (Arbeitnow/Remotive) dan di-cache 12 jam di `job_radar_cache` beserta estimasi skor kecocokan `Skill` secara deterministik.
_Avoid_: Scraped Job, Aggregated Vacancy

**Digest Summary**:
Ringkasan Bahasa Indonesia 3 poin (*Inti Berita*, *Istilah IT Baru*, *Kenapa Penting*) yang di-generate *on-demand* dari satu entri `Daily Digest` dan di-cache permanen pada `daily_digests.ai_summary`.
_Avoid_: TLDR Block, Auto Digest Brief

**Interview AI Feedback**:
Hasil evaluasi multimodal Gemini Audio atas satu `Interview Attempt` yang memuat transkrip, skor kerangka 3 poin (`content_review`), skor gaya penyampaian & *filler words* (`delivery_review`), serta rekomendasi `suggested_confidence`.
_Avoid_: Voice Grade, Audio Score

**Portfolio Summary**:
Ringkasan aset lamaran hasil *One-App Capstone* berisi 3–4 *bullet* CV ramah ATS (ID & EN) serta draf cerita STAR 90 detik, di-cache permanen pada `learning_tracks.portfolio_summary`.
_Avoid_: Resume Draft, Project Bio

---

## Matriks Penamaan Lintas Lapisan (DB / TypeScript / API / UI)

| Istilah Domain | Tabel DB (`snake_case`) | Tipe TypeScript (`PascalCase`) | Resource / Path API | Label UI Kanonik |
| :--- | :--- | :--- | :--- | :--- |
| Profile | `profiles` | `Profile` | `/api/github/sync` (update) | Profil |
| Skill | `skills` | `Skill` | `/skills`, `/api/github/sync` | Skill / Master Skills |
| Target Internship | `target_internships` | `TargetInternship` | `/api/internships/analyze` | Target Magang |
| Internship Skill *(relasi)* | `internship_skills` | `InternshipSkill` | *(bagian dari Target Internship)* | Matriks Skill Lowongan |
| Readiness Meter | *(dihitung dari `internship_skills`)* | `ReadinessMeter` (`readinessScore`) | *(computed)* | Readiness Meter |
| Jargon Glossary | `target_internships.jargon_glossary` | `JargonEntry` | *(bagian dari Target Internship)* | Glosarium Istilah JD |
| Curated Resource | `curated_resources` | `CuratedResource` | `/api/resources/lookup` | Referensi Terkurasi |
| Learning Track | `learning_tracks` | `LearningTrack` | `/api/tracks/generate` | Learning Track / Capstone |
| Track Module | `track_modules` | `TrackModule` | `/api/tracks/[id]/modules/[moduleId]/generate` | Modul Praktikum |
| Warm-up Drill | `track_modules.warmup_drills` | `WarmupDrill` | *(bagian dari Track Module)* | Warm-up Drill |
| Hands-On Ticket | `track_modules.hands_on_ticket` | `HandsOnTicket` | *(bagian dari Track Module)* | Hands-On Ticket |
| Lab Submission | `lab_submissions` | `LabSubmission` | `/api/labs/review` | Lab Submission |
| Daily Digest | `daily_digests` | `DailyDigest` | `/api/cron/daily-digest` | Daily Digest |
| Note | `notes` | `Note` | *(Server Actions `/notes`)* | Catatan & Cheat-Sheet |
| Cloze Deletion | *(parsed dari `notes.content_md`)* | `ClozeItem` | *(client/server lib)* | Soal Cloze |
| Quiz Attempt | `quiz_attempts` | `QuizAttempt` | *(Server Actions `/quiz`)* | Riwayat Kuis |
| Interview Card | `interview_cards` | `InterviewCard` | *(Server Actions `/interview`)* | Kartu Interview |
| Interview Attempt | `interview_attempts` | `InterviewAttempt` | *(Server Actions `/interview`)* | Riwayat Sesi Interview |
| Today's Focus | *(dihitung di server)* | `TodaysFocus` | *(computed di `/dashboard`)* | Today's Focus |
| MCQ Question | `track_modules.mcq_questions`, `notes.mcq_questions` | `McqQuestion` | `/api/quiz/mcq/generate` | Kuis Pilihan Ganda (A/B/C/D) |
| Module Tutor | *(stateless, tidak disimpan di DB)* | `ModuleTutorReply` | `/api/tracks/[id]/modules/[moduleId]/tutor` | Tutor Modul |
| Job Radar Item | `job_radar_cache` | `JobRadarItem` | `/api/internships/radar` | Radar Lowongan Terbuka |
| Digest Summary | `daily_digests.ai_summary` | `DigestAiSummary` | `/api/digest/[id]/summarize` | Ringkasan Berita AI |
| Interview AI Feedback | `interview_attempts.ai_feedback` (+ `transcript`) | `InterviewAiFeedback` | `/api/interview/review` | Evaluasi AI Suara |
| Portfolio Summary | `learning_tracks.portfolio_summary` | `PortfolioSummary` | `/api/tracks/[id]/portfolio-summary` | Bullet CV & Cerita STAR |

---

## Canonical Enum Values

Seluruh nilai enum di PostgreSQL, skema validasi, tipe TypeScript, dan payload API wajib memakai literal persis di bawah ini:

| Nama Enum / Tipe | Nilai Kanonik (Exact Literals) | Dipakai Pada |
| :--- | :--- | :--- |
| `skill_category` | `'language' \| 'framework' \| 'concept' \| 'tool'` | `skills.category` |
| `skill_status` | `'gap' \| 'learning' \| 'mastered'` | `skills.status` |
| `skill_source` | `'github' \| 'jd' \| 'manual'` | `skills.source` |
| `internship_status` | `'preparing' \| 'applied' \| 'interview' \| 'offer' \| 'rejected'` | `target_internships.status` |
| `skill_priority` | `'must_have' \| 'nice_to_have'` | `internship_skills.priority` |
| `resource_source` | `'devto' \| 'stackoverflow' \| 'mdn' \| 'wikipedia' \| 'youtube' \| 'github'` | `curated_resources.source` |
| `track_status` | `'active' \| 'completed' \| 'archived'` | `learning_tracks.status` |
| `module_type` | `'capstone_feature' \| 'microservice' \| 'language_native'` | `track_modules.module_type` |
| `module_status` | `'locked' \| 'in_progress' \| 'completed'` | `track_modules.status` |
| `module_content_status` | `'pending' \| 'ready' \| 'failed'` | `track_modules.content_status` |
| `digest_source` | `'devto' \| 'hackernews'` | `daily_digests.source` |
| `digest_category` *(check constraint)* | `'skill_gap' \| 'trending_it'` | `daily_digests.category` |
| `job_radar_source` *(check constraint)* | `'arbeitnow' \| 'remotive'` | `job_radar_cache.source` |
| `quiz_source_type` | `'note_cloze' \| 'module_drill' \| 'module_mcq' \| 'note_mcq'` | `quiz_attempts.source_type` |
| `interview_card_source` | `'lab_review' \| 'skill_gap' \| 'manual'` | `interview_cards.source` |
| `confidence_level` | `'confused' \| 'partial' \| 'ready'` | `interview_cards.confidence_level`, `interview_attempts.confidence_level` |

---

## Relasi Entitas & Domain Invariants

### Peta Relasi Entitas

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
job_radar_cache                                    [shared public feed cache, TTL 12h]
```

### Domain Invariants (Aturan yang Tidak Boleh Dilanggar)

1. **Keunikan & Cakupan `Skill`:** Kombinasi `(user_id, slug)` pada `skills` wajib unik dan hanya merepresentasikan *hard engineering skills*; *soft skills* non-teknis tidak disimpan sebagai `Skill`.
2. **Derivasi `Skill Status`:** Nilai `skills.status` selalu diturunkan secara deterministik dari `skills.mastery_score` (`0–29` → `gap`, `30–79` → `learning`, `80–100` → `mastered`).
3. **Batas & Agregasi `Mastery Score`:** Nilai `mastery_score` selalu berada dalam rentang `[0, 100]`:
   - *0 sinyal aktivitas:* `40` jika `source = 'github'`, atau `0` jika `source = 'jd' | 'manual'`.
   - *Tepat 1 jenis sinyal aktif:* skor dibatasi maksimal `65` (untuk `source = 'github'`, nilai minimum `40` sehingga `max(40, skor)`).
   - *Dua atau lebih jenis sinyal aktif:* bobot dasar (`Quiz = 30`, `Lab = 40`, `Interview = 30`) dinormalisasi ulang terhadap total bobot sinyal yang tersedia menjadi `100%`.
4. **Kalkulasi `Readiness Meter`:** Skor berada dalam rentang `[0, 100]` dan dihitung sebagai rata-rata tertimbang `mastery_score` seluruh `internship_skills` terkait dengan bobot `must_have = 2` dan `nice_to_have = 1` (`0` bila belum ada `Skill` terpetakan).
5. **Pemisahan Status `Track Module`:** `track_modules.status` (`locked | in_progress | completed`) independen dari `track_modules.content_status` (`pending | ready | failed`); kolom konten (`concept_brief`, `warmup_drills`, `hands_on_ticket`) hanya dijamin lengkap ketika `content_status = 'ready'`.
6. **Idempotensi `Daily Digest`:** Kombinasi `(user_id, source, external_id)` pada `daily_digests` wajib unik sehingga eksekusi ulang harian tidak pernah menggandakan artikel yang sama.
7. **Pemisahan State & Riwayat Interview:** Satu `InterviewCard` memegang tepat satu jadwal *Spaced Repetition* aktif (`next_review_at`), sedangkan setiap penyelesaian latihan dicatat sebagai baris baru *append-only* di `interview_attempts` sambil memperbarui `next_review_at`, `confidence_level`, dan `review_count` pada kartu induknya.
8. **Isolasi Kepemilikan Data:** Seluruh entitas milik pengguna terikat pada `user_id` (atau mewarisi kepemilikan melalui parent-nya) dan dilindungi oleh *Row Level Security* (RLS) penuh.
9. **Backward-Compatibility Konten Modul & MCQ:** Skema `concept_brief` v2 menjaga field v1 (`summary`, `analogy`, `key_points`) tetap valid, dan `mcq_questions` bersifat nullable sehingga modul maupun catatan lama tetap berfungsi penuh.
10. **Pemrosesan Audio Tanpa Storage (*Stateless*):** Audio *Voice Interview* dibatasi maks. `3.5 MB` (MIME `audio/webm | audio/mp4 | audio/ogg | audio/wav`, durasi >3 detik), dikonversi ke Base64 *in-memory* lalu dibuang setelah respons AI diterima; hanya `transcript` dan `ai_feedback` tervalidasi Zod yang disimpan ke `interview_attempts`.
11. **Isolasi Kredensial & Cooldown Refresh:** `SUPABASE_SECRET_KEY` hanya digunakan pada `/api/cron/daily-digest`; cache `job_radar_cache` (TTL 12 jam) dan refresh manual `/api/digest/refresh` (cooldown 6 jam via `profiles.last_digest_refresh`) dieksekusi menggunakan sesi terautentikasi via RLS.
