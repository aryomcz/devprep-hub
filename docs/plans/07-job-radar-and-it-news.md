# Plan 07 — Job Radar Magang Terbuka & Upgrade Info Dunia IT (`/digest`)

**Fase:** 7 dari 9 (Upgrade v1.1 Paket 2: Radar Lowongan Kerja Terbuka Arbeitnow/Remotive, Pintasan Loker Indonesia, Digest 2-Kategori & Ringkasan Berita AI)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) (`Bagian 12`) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-002`, `ADR-003`, `ADR-005`, `ADR-007`, `ADR-011`, `ADR-014`)  
**Aturan Seam (`/codebase-design`):** `src/lib/job-matcher.ts` adalah modul komputasi deterministik murni bebas I/O (memakai ulang `normalizeSkill` dari `skill-normalizer.ts`); `src/services/external/job-radar.ts` dan `daily-digest.ts` memakai `Promise.allSettled` + `AbortSignal.timeout(4000)` dengan adapter *seam* pengujian; `src/services/ai/digest-summarizer.ts` menerima adapter AI; `SUPABASE_SECRET_KEY` tetap terisolasi eksklusif di `/api/cron/daily-digest`.  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Step 7.1 — Migrasi `0007`, Modul Murni `job-matcher.ts`, & *Deep Service* `job-radar.ts`

- **Blocked by:** `Plan 01`–`05` (`0005_tracks_and_labs_rpcs.sql`)
- **What to build:** Menambah tabel cache `job_radar_cache` + kolom `daily_digests.{category, ai_summary}` + `profiles.last_digest_refresh`, membangun kalkulator kecocokan lowongan deterministik `job-matcher.ts` (TDD), serta *deep service* penarik API **Arbeitnow & Remotive** paralel dengan cache 12 jam.

### Daftar File
- `supabase/migrations/0007_job_radar_and_digest_upgrade.sql` *(baru)*
- `src/types/database.ts` *(modifikasi: tambah tabel `job_radar_cache` & kolom baru `daily_digests`/`profiles`)*
- `src/types/schemas.ts` *(modifikasi: tambah `digestCategorySchema`, `jobRadarSourceSchema`, `digestAiSummarySchema`)*
- `src/lib/job-matcher.ts` *(baru)*
- `src/lib/__tests__/job-matcher.test.ts` *(baru)*
- `src/services/external/job-radar.ts` *(baru)*
- `src/services/external/__tests__/job-radar.test.ts` *(baru)*

### Tugas
- [ ] Buat migrasi `supabase/migrations/0007_job_radar_and_digest_upgrade.sql`:
  - Buat tabel `public.job_radar_cache` (`id`, `source`, `external_id`, `title`, `company_name`, `location`, `is_remote`, `url`, `description_snippet`, `tags text[]`, `published_at`, `fetched_at`) dengan `UNIQUE (source, external_id)`, check constraint `source in ('arbeitnow', 'remotive')`, serta RLS `select`/`insert`/`update` untuk role `authenticated`.
  - Tambah kolom `category text not null default 'skill_gap'` (`check (category in ('skill_gap', 'trending_it'))`) dan `ai_summary jsonb` pada `public.daily_digests`, beserta index `(user_id, category, digest_date desc)`.
  - Tambah kolom `last_digest_refresh timestamptz` pada `public.profiles`.
- [ ] Tulis unit test (`tdd`) di `src/lib/__tests__/job-matcher.test.ts` lalu bangun `src/lib/job-matcher.ts`:
  - Cocokkan tag & judul/cuplikan deskripsi lowongan memakai `normalizeSkill()` (`src/lib/skill-normalizer.ts`) terhadap master `Skill` pengguna.
  - Kembalikan skor kecocokan `0–100` dan daftar nama `matchedSkills[]` secara deterministik tanpa LLM.
- [ ] Bangun `src/services/external/job-radar.ts` + `job-radar.test.ts` (uji *partial failure*, *timeout* 4 detik, filter kata kunci `intern | junior | entry | graduate | software`, sanitasi URL `http/https`, dan cache 12 jam via *injected store & fetch adapter*).

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`job-matcher.test.ts` & `job-radar.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Cek `ADR-011`: `job-matcher.ts` 100% bebas I/O & Next.js; `job-radar.ts` 100% bebas primitif Next.js.

### Saran Conventional Commit
```text
feat(internships): add 0007 migration, deterministic job-matcher, and Arbeitnow/Remotive radar service
```

---

## Step 7.2 — Endpoint `GET /api/internships/radar` & UI `JobRadarTab` + Pintasan Loker Indonesia

- **Blocked by:** `Step 7.1`
- **What to build:** Menyediakan Route Handler radar lowongan terbuka ber-cache 12 jam (`?refresh=true` ber-cooldown) dan tab **Radar Lowongan** di `/internships` lengkap dengan skor kecocokan skill, tombol 1-klik **"Analisis ke Target Magang"**, serta blok **Pintasan Loker Magang Indonesia**.

### Daftar File
- `src/app/api/internships/radar/route.ts` *(baru)*
- `src/components/internships/JobRadarTab.tsx` *(baru)*
- `src/components/internships/JDAnalyzerForm.tsx` *(modifikasi minimal: terima initial pre-fill / controlled trigger opsional dari `JobRadarTab`)*
- `src/app/(dashboard)/internships/page.tsx` *(modifikasi: tambah tab Daftar Target Magang vs Radar Lowongan Terbuka)*

### Tugas
- [ ] Buat Route Handler tipis `src/app/api/internships/radar/route.ts` (`export const maxDuration = 30`):
  - Wajib `requireAllowedUser()`.
  - Baca `job_radar_cache` (TTL 12 jam) memakai Supabase user session RLS; bila stale atau `?refresh=true` lolos cooldown (mis. ≥15 menit sejak `fetched_at` terbaru), tarik ulang via `getOrFetchJobRadarItems()`.
  - Hitung kecocokan terhadap `skills` pengguna lewat `src/lib/job-matcher.ts` dan kembalikan daftar terurut skor tertinggi/terbaru.
- [ ] Bangun `src/components/internships/JobRadarTab.tsx`:
  - Filter cepat (`Semua`, `Remote Only`), tombol **Perbarui Radar** (hormati cooldown), badge persentase kecocokan (`font-mono tabular-nums`), dan tombol **"Analisis ke Target Magang"** yang membuka `JDAnalyzerForm` terisi judul, perusahaan, dan deskripsi/tautan lowongan.
  - Blok **Pintasan Loker Magang Indonesia**: rangkai otomatis tautan pencarian aman (`toSafeExternalHref`) ke **LinkedIn Jobs**, **Glints**, dan **Kalibrr** menggunakan 3–5 *skill* teratas pengguna agar mudah disalin ke JD Analyzer.
- [ ] Hubungkan `JobRadarTab` ke `src/app/(dashboard)/internships/page.tsx` memakai `Tabs` `shadcn/ui`.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal `/internships`: tab Radar memuat cache tanpa memanggil Gemini, tombol 1-klik mengisi form `JDAnalyzerForm`, dan pintasan Indonesia mengarah ke URL pencarian yang valid.

### Saran Conventional Commit
```text
feat(internships): add job radar endpoint, matched feed UI, and Indonesia internship shortcuts
```

---

## Step 7.3 — Upgrade `daily-digest.ts`, Cron 2-Kategori & Endpoint Manual `POST /api/digest/refresh`

- **Blocked by:** `Step 7.1`
- **What to build:** Memperluas kurasi berita IT agar menghasilkan kategori **`skill_gap`** sekaligus **`trending_it`**, memperbarui `/api/cron/daily-digest`, dan menyediakan endpoint manual `POST /api/digest/refresh` (cooldown 6 jam) tanpa menyentuh `SUPABASE_SECRET_KEY`.

### Daftar File
- `src/services/external/daily-digest.ts` *(modifikasi: kembalikan entri `skill_gap` + `trending_it`)*
- `src/services/external/__tests__/daily-digest.test.ts` *(modifikasi: uji pembagian 2 kategori & tetap idempoten terhadap URL ganda)*
- `src/app/api/cron/daily-digest/route.ts` *(modifikasi: simpan kolom `category` pada `daily_digests`)*
- `src/app/api/cron/daily-digest/__tests__/route.test.ts` *(modifikasi: pastikan payload cron menyertakan `category`)*
- `src/app/api/digest/refresh/route.ts` *(baru)*

### Tugas
- [ ] Perbarui `curateDailyDigestForUser` di `src/services/external/daily-digest.ts`:
  - Kembalikan hingga 2 entri **`skill_gap`** (cocok dengan `Skill` berstatus `gap`/`learning`) **plus** hingga 2 entri **`trending_it`** (*top engineering stories* Hacker News / Dev.to populer yang tidak harus cocok dengan *skill gap*, `matched_skill_id: null`).
  - Perbarui `daily-digest.test.ts` dan `route.test.ts` untuk memverifikasi perilaku 2-kategori.
- [ ] Perbarui `src/app/api/cron/daily-digest/route.ts` agar menyisipkan kolom `category` saat upsert idempoten (`onConflict: 'user_id,source,external_id'`).
- [ ] Buat Route Handler `src/app/api/digest/refresh/route.ts` (`export const maxDuration = 30`):
  - Wajib `requireAllowedUser()` dan pakai `createClient()` (RLS user, **bukan** `createAdminClient()` / `SUPABASE_SECRET_KEY`).
  - Cek `profiles.last_digest_refresh`; jika belum 6 jam, kembalikan `429` beserta sisa waktu cooldown yang jelas; jika lolos, panggil `curateDailyDigestForUser`, upsert ke `daily_digests`, dan perbarui `profiles.last_digest_refresh`.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`daily-digest.test.ts` & cron `route.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Audit keamanan: pastikan `createAdminClient` hanya diimpor oleh `src/app/api/cron/daily-digest/route.ts`.

### Saran Conventional Commit
```text
feat(digest): add two-category IT news curation and 6h cooldown manual refresh endpoint
```

---

## Step 7.4 — AI Digest Summarizer (`POST /api/digest/[id]/summarize`) & Upgrade UI `/digest`

- **Blocked by:** `Step 7.3`
- **What to build:** Ringkasan Berita AI dalam Bahasa Indonesia 3 poin *(1. Inti Berita, 2. Istilah IT Baru, 3. Kenapa Penting untuk Engineer)* yang di-cache permanen di `daily_digests.ai_summary`, beserta tampilan `/digest` yang terpisah antar kategori + tombol **"Tarik Berita Sekarang"**.

### Daftar File
- `src/services/ai/digest-summarizer.ts` *(baru)*
- `src/services/ai/__tests__/digest-summarizer.test.ts` *(baru)*
- `src/app/api/digest/[id]/summarize/route.ts` *(baru)*
- `src/components/digest/DigestSummaryCard.tsx` *(baru)*
- `src/components/digest/DigestArchive.tsx` *(modifikasi: filter kategori `skill_gap` / `trending_it`, tombol **Tarik Berita Sekarang**, & render `DigestSummaryCard`)*
- `src/app/(dashboard)/digest/page.tsx` *(modifikasi: ikut select `category`, `ai_summary`, dan `profiles.last_digest_refresh`)*

### Tugas
- [ ] Bangun *deep module* `src/services/ai/digest-summarizer.ts` (`summarizeDigestArticle(input, aiAdapter?)`) + `digest-summarizer.test.ts`:
  - Hasilkan `digestAiSummarySchema`: `{ core_point, new_it_terms: [{ term, brief }], why_it_matters }` berbahasa Indonesia yang jelas (berbasis judul, tags, & metadata resmi artikel).
- [ ] Buat Route Handler tipis `src/app/api/digest/[id]/summarize/route.ts` (`export const maxDuration = 30`):
  - Wajib `requireAllowedUser()`; jika `daily_digests.ai_summary` sudah ada, langsung kembalikan dari DB (*Generate Once, Cache Forever*); jika kosong, panggil `summarizeDigestArticle`, simpan permanen ke `daily_digests.ai_summary`, lalu `revalidatePath('/digest')`.
- [ ] Buat `src/components/digest/DigestSummaryCard.tsx` untuk menampilkan 3 poin ringkasan Bahasa Indonesia + tombol *Save to Note* untuk istilah IT baru bila diinginkan.
- [ ] Perbarui `DigestArchive.tsx` dan `src/app/(dashboard)/digest/page.tsx`:
  - Tambahkan badge & filter kategori **Untuk Skill Gap-mu** vs **Trending IT & Istilah Baru**, tombol **"Tarik Berita Sekarang"** (tampilkan sisa cooldown 6 jam bila ada), dan tombol **"Ringkas (ID)"** per artikel.

### Verification Checklist
- [ ] `npx tsc --noEmit` lulus dengan 0 error.
- [ ] `npm run lint` lulus dengan 0 error & 0 warning.
- [ ] `npm test` lulus 100% (`digest-summarizer.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal `/digest` di Light & Dark Mode: tarik berita manual, ringkas 1 artikel, lalu refresh browser dan pastikan ringkasan dimuat instan dari PostgreSQL.

### Saran Conventional Commit
```text
feat(digest): add on-demand Indonesian AI summary and upgraded /digest category UI
```

---

## Handoff Log

*(Diisi setelah tiap sub-step lulus verifikasi dan disetujui pengguna.)*
