# Architecture Decision Records (ADR) — DevPrep Hub

Dokumen ini mencatat keputusan teknis dan arsitektur penting agar setiap sesi pengembangan (dan setiap model AI) memahami alasan di balik desain sistem tanpa mengulang perdebatan yang sama.

## Format Entri
- **ID & Judul:** `ADR-XXX: Judul Singkat`
- **Tanggal & Status:** `YYYY-MM-DD` | `Proposed` / `Accepted` / `Superseded`
- **Konteks:** Masalah atau kebutuhan singkat.
- **Keputusan:** Solusi yang dipilih.
- **Konsekuensi:** Dampak atau batasan yang harus dijaga.

---

## Keputusan Terkunci (Accepted)

### ADR-001: Arsitektur Next.js Full-Stack + Supabase pada Free Tier
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Aplikasi ditujukan untuk penggunaan pribadi jangka panjang tanpa biaya hosting dan tanpa *cold start* yang mengganggu.
- **Keputusan:** Menggunakan Next.js App Router (Server Actions + Route Handlers) di Vercel Hobby dan Supabase (PostgreSQL + Auth + RLS) tanpa memisahkan server Express.js.
- **Konsekuensi:** Seluruh logika *backend* dan kredensial wajib terisolasi di sisi server Next.js serta mematuhi batas *serverless timeout* Vercel.

### ADR-002: Strategi "Generate Once, Cache Forever" dengan JSONB
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Pemanggilan Gemini API Free Tier dan beberapa Public API secara berulang berisiko terkena *rate limit* dan memperlambat tampilan halaman.
- **Keputusan:** Menyimpan hasil ekstraksi JD (`jargon_glossary`), referensi Public API (`curated_resources`), dan struktur kurikulum (`track_modules`) secara permanen di PostgreSQL (`JSONB`).
- **Konsekuensi:** Skema JSON wajib divalidasi dengan Zod sebelum disimpan agar perubahan struktur di masa depan tidak merusak UI.

### ADR-003: Vercel Cron Harian untuk Daily Digest & Anti-Pause Supabase
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Proyek Supabase Free Tier akan otomatis *pause* setelah 7 hari tanpa aktivitas database, sekaligus aplikasi membutuhkan kurasi bacaan teknis harian.
- **Keputusan:** Menjalankan 1 *Vercel Cron Job* harian (`/api/cron/daily-digest`) untuk menarik artikel Dev.to & Hacker News dan menyimpannya ke tabel `daily_digests`.
- **Konsekuensi:** Endpoint cron wajib memvalidasi `CRON_SECRET` dan tabel `daily_digests` menegakkan *unique constraint* `(user_id, source, external_id)` untuk menjamin idempotensi di level PostgreSQL.

### ADR-004: Kuis Active Recall Deterministik dengan Sintaks Cloze `{{...}}`
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Pembuatan kuis *fill-in-the-blank* dari catatan pribadi harus instan tanpa kuota LLM, namun sintaks `{{...}}` rawan bentrok dengan kode JSX, GitHub Actions, atau template.
- **Keputusan:** Teks prosa memakai `{{jawaban}}` atau `{{jawaban::petunjuk}}` dengan dukungan escape `\{\{...\}\}`; di dalam *fenced code block* dan *inline code*, `{{...}}` diabaikan default dan wajib opt-in eksplisit `{{cloze:...}}`, serta menolak *cloze* kosong atau lintas baris.
- **Konsekuensi:** `src/lib/cloze-parser.ts` harus diimplementasikan secara *state-aware* (bukan satu regex global) disertai unit test (`tdd`) yang memverifikasi seluruh *edge case*.

### ADR-005: Akses Database via `@supabase/supabase-js` + RLS Penuh (Tanpa Prisma ORM)
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Prisma secara default melewati RLS Supabase, menambah beban *cold start* serta konfigurasi PgBouncer di Vercel Hobby, dan memecah *source of truth* migrasi SQL.
- **Keputusan:** Menggunakan `@supabase/supabase-js` + `@supabase/ssr` dengan RLS aktif di seluruh tabel, migrasi SQL terversi di `supabase/migrations/*.sql`, *generated TypeScript types*, validasi Zod untuk kolom `JSONB`, dan PostgreSQL RPC untuk mutasi atomik lintas tabel.
- **Konsekuensi:** Hapus rencana direktori `prisma/`; klien publik/SSR memakai `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, hanya `/api/cron/daily-digest` yang diizinkan memakai `SUPABASE_SECRET_KEY`, sementara operasi multi-tabel atomik ditulis sebagai fungsi SQL RPC.

### ADR-006: Pipeline AI 2-Tahap (*Decoupled & On-Demand*) Anti-Timeout & Hemat Kuota
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Ekstraksi JD sekaligus *Hybrid Sourcing* dan generasi seluruh `track_modules` dalam satu *request* berisiko melewati batas *serverless timeout* Vercel Hobby serta memboroskan kuota Gemini Free Tier.
- **Keputusan:** Memisahkan `/api/internships/analyze` dari *Hybrid Sourcing*; `/api/tracks/generate` hanya membuat blueprint `LearningTrack` beserta kerangka modul (`content_status = 'pending'`), lalu detail modul + *Hybrid Sourcing* (cache 7 hari) dipicu *on-demand* lewat `POST /api/tracks/[id]/modules/[moduleId]/generate` dengan `maxDuration = 30`, maks. 1 *retry*, dan tombol *Coba Generate Ulang*.
- **Konsekuensi:** Ada jeda singkat saat pertama kali membuka tiap modul sebelum di-cache permanen, serta tabel `track_modules` wajib memisahkan kolom `content_status` (`pending | ready | failed`) dari `status` progres belajar.

### ADR-007: Strategi *Skill Deduplication* 3 Lapis
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Normalisasi slug sederhana gagal menyatukan alias seperti `Postgres` vs `PostgreSQL` atau `JS` vs `JavaScript`, dan berisiko menabrakkan `C`, `C++`, dan `C#`.
- **Keputusan:** Menerapkan 3 lapis deduplikasi: (1) canonicalizer deterministik simbol (`c++ → cpp`, `c# → csharp`, `.net → dotnet`) + kamus alias di `src/lib/skill-normalizer.ts`, (2) injeksi daftar `slug` dan `name` `Skill` eksisting pengguna ke prompt ekstraksi JD, dan (3) fitur *Merge Skill* manual di `/skills` via PostgreSQL RPC.
- **Konsekuensi:** Prompt analisis JD bertambah ~200–400 token, kamus alias perlu dirawat bertahap bila muncul variasi istilah baru, dan aksi *Merge Skill* wajib memindahkan seluruh relasi anak secara atomik.

### ADR-008: Formula `mastery_score` Dinamis, Sinkronisasi Status, & `Readiness Meter`
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Bobot kaku `30/40/30` membuat skill konseptual tanpa lab tidak pernah bisa mencapai `mastered`, sedangkan 1 kuis singkat saja tidak boleh langsung melabeli keahlian sebagai `mastered`.
- **Keputusan:** Bobot dasar sinyal `Quiz 30 / Lab 40 / Interview 30` dengan *baseline* GitHub `40` (lainnya `0`), *cap* maks. `65` jika baru 1 jenis sinyal aktif (`max(40, skor)` untuk GitHub), dan renormalisasi bobot menjadi `100%` bila ≥2 sinyal aktif; `skills.status` diturunkan otomatis (`0–29 gap`, `30–79 learning`, `80–100 mastered`), dan `Readiness Meter` memakai rata-rata tertimbang `must_have = 2 : nice_to_have = 1`.
- **Konsekuensi:** UI perlu menampilkan rincian kontribusi sinyal (Q/L/I) agar pengguna memahami batas skor sementara, dan kalkulasi di `src/lib/mastery.ts` wajib dilindungi *unit test* tabel yang komprehensif.

### ADR-009: Editor Ringan Tanpa Heavy Code IDE
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** *Warm-up Drill* hanya berisi 3–5 soal rumpang singkat dan proyek *Capstone* tetap dikodekan di IDE lokal, sehingga memuat Monaco/CodeMirror akan membengkakkan *bundle* dan mengganggu UX mobile.
- **Keputusan:** *Warm-up Drill* dirender sebagai blok kode *read-only* ber-*syntax highlight* ringan dengan `<input>` *inline* monospace pada tiap slot kosong; *Notes* dan *Lab Submission* memakai `<textarea>` monospace terkontrol (*Notes* dilengkapi toolbar *Cloze* dan *live preview* Markdown).
- **Konsekuensi:** Tidak ada *autocomplete* atau *linting* IDE langsung di browser pada form *Lab Submission*, sebagai imbalan *bundle* tetap ramping, *hydration* React 19 instan, dan fokus pengerjaan *drill* terjaga.

### ADR-010: Pemisahan `interview_cards` vs `interview_attempts` & Guardrail Operasional Free Tier
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Menyatukan jadwal *Spaced Repetition* dan log riwayat dalam satu tabel tunggal menyebabkan baris lama terus muncul sebagai antrean *overdue*, sementara deployment publik dan Next.js 16 membawa risiko kebocoran kuota, *token overflow*, dan konvensi file yang usang.
- **Keputusan:** Memecah tabel menjadi `interview_cards` (jadwal aktif) dan `interview_attempts` (*append-only* log); menerapkan *Single-User Gate* (`ALLOWED_USER_EMAIL` + nonaktifkan *public signup*); memakai `src/proxy.ts` sesuai Next.js 16; serta membatasi payload eksternal (maks. 20 repo non-fork GitHub, 12.000 karakter *diff* commit non-lockfile/binary, dan 15.000 karakter input JD).
- **Konsekuensi:** Penambahan tabel `interview_attempts` dan variabel env `ALLOWED_USER_EMAIL` di `.env.example`, namun antrean review tetap bebas duplikasi dan konsumsi kuota Gemini terlindungi dari penyalahgunaan serta lonjakan token.

### ADR-011: Batas Modul & Seam 4 Lapisan (`lib`, `services`, `actions`, `app/api`)
- **Tanggal & Status:** 2026-11-25 | `Accepted`
- **Konteks:** Tanpa aturan arah dependensi dan *seam* yang tegas, logika domain, panggilan LLM/Public API, serta primitif HTTP/UI Next.js rawan bocor lintas lapisan dan sulit diuji secara terisolasi.
- **Keputusan:** Membagi kode ke 4 lapisan searah: (1) `src/lib/` untuk modul domain murni *in-process* bebas I/O (`skill-normalizer`, `cloze-parser`, `mastery`, `spaced-repetition`, `diff-sanitizer`, `todays-focus`) + *factory* klien tipis (`supabase`, `gemini`, `auth-guard`); (2) `src/services/{external,ai}/` untuk *deep modules* orkestrasi I/O eksternal yang menerima *injected adapter* di *seam* pengujian dan bebas dari primitif Next.js (`NextRequest`/`cookies`/`revalidatePath`); (3) `src/actions/` khusus mutasi CRUD database terautentikasi via RLS + `revalidatePath` tanpa memanggil LLM/Public API; dan (4) `src/app/api/` khusus *adapter* HTTP tipis (`maxDuration`, guard auth/cron, cek cache DB, delegasi ke `src/services/`).
- **Konsekuensi:** Aliran dependensi wajib satu arah (`UI → actions / app/api → services → lib → types`); modul domain di `src/lib/` diuji langsung tanpa mock, sedangkan `src/services/` diuji melalui *seam* adapter tiruan tanpa koneksi jaringan.
