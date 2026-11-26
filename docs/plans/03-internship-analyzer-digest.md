# Plan 03 — Custom Internship Analyzer, Hybrid Sourcing & Daily Digest

**Fase:** 3 dari 5 (Analisis Lowongan Magang, Deduplikasi 3 Lapis, *Readiness Meter*, *Hybrid Sourcing*, & Cron *Daily Digest*)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-002`, `ADR-003`, `ADR-006`, `ADR-007`, `ADR-011`)  
**Aturan Seam (`/codebase-design`):** `src/services/ai/jd-analyzer.ts` dan `src/services/external/{hybrid-sourcing,daily-digest}.ts` adalah *deep modules* yang menerima adapter LLM/`fetch` pada argumen *seam* untuk pengujian; `src/app/api/*` bertindak sebagai HTTP adapter tipis (`maxDuration = 30`, guard auth/cron, transaksi RPC DB).  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Step 3.1 — Gemini Structured Output Client & Deep Service JD Analyzer

- **Blocked by:** `Step 1.3`
- **What to build:** Membangun wrapper klien Gemini API (`src/lib/gemini.ts`) dengan dukungan *Structured JSON Output* + klasifikasi error `429`/timeout, serta *deep module* `src/services/ai/jd-analyzer.ts` untuk ekstraksi *hard engineering skills*, `JargonGlossary`, dan deduplikasi 3 lapis.

### Daftar File
- `src/lib/gemini.ts` *(baru)*
- `src/services/ai/jd-analyzer.ts` *(baru)*
- `src/services/ai/__tests__/jd-analyzer.test.ts` *(baru)*

### Tugas
- [x] Buat *thin factory* `src/lib/gemini.ts`: baca `GEMINI_API_KEY` hanya di server, bungkus pemanggilan Gemini REST API (`generateStructuredJson<T>({ prompt, jsonSchema, schema, timeoutMs })`) dengan validasi output Zod, deteksi eksplisit *rate limit* (`429` → error terstruktur `GeminiRateLimitError`), dan maks. 1 *retry* ringan untuk kegagalan sementara.
- [x] Bangun `src/services/ai/jd-analyzer.ts` (`analyzeInternshipInput(input, existingSkills, generateFn?)`):
  - Terima 3 mode input (`raw_jd`, `manual_skills`, `role_industry`) dan tegakkan batas **maks. 15.000 karakter** pada teks JD mentah.
  - Injeksikan daftar `{ slug, name }` `Skill` eksisting pengguna ke dalam prompt (Lapis 2 deduplikasi `ADR-007`).
  - Instruksikan prompt untuk **hanya mengekstrak hard engineering skills** (`language | framework | concept | tool`) dan membuang *soft skills* HR (*"team player"*, *"good communication"*, dll.).
  - Jalankan `src/lib/skill-normalizer.ts` (Lapis 1) pada seluruh skill hasil ekstraksi untuk mencegah duplikasi (`Postgres` → `PostgreSQL`) dan gabungkan tabrakan `must_have` vs `nice_to_have` (prioritas lebih tinggi menang).
- [x] Tulis `src/services/ai/__tests__/jd-analyzer.test.ts` dengan mock `generateFn` pada *seam* argumen untuk menguji: penolakan input >15.000 karakter, pemetaan ke skill eksisting, deduplikasi alias hasil AI, dan propagasi `GeminiRateLimitError`.

### Verification Checklist
- [x] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`jd-analyzer.test.ts` hijau tanpa API key asli).
- [x] Cek keamanan: `GEMINI_API_KEY` hanya direferensikan di `src/lib/gemini.ts` (server-only) dan tidak ada import Next.js di `src/services/ai/jd-analyzer.ts`.

### Saran Conventional Commit
```text
feat(analyzer): add gemini structured client and 3-layer jd analyzer service
```

---

## Step 3.2 — Endpoint `POST /api/internships/analyze`, Atomic RPC Storage & Halaman `/internships`

- **Blocked by:** `Step 3.1`, `Step 2.2`
- **What to build:** Menghubungkan `jd-analyzer.ts` ke Route Handler `POST /api/internships/analyze` (`ADR-006`: terpisah dari *Hybrid Sourcing*), transaksi RPC PostgreSQL atomik, serta UI `/internships` dan `/internships/[id]` lengkap dengan `ReadinessMeter` `2:1` dan tombol **Save to Note** pada `JargonGlossary`.

### Daftar File
- `src/app/api/internships/analyze/route.ts` *(baru)*
- `src/actions/internships.ts` *(baru)*
- `src/components/internships/JDAnalyzerForm.tsx` *(baru)*
- `src/components/internships/ReadinessCard.tsx` *(baru)*
- `src/components/internships/JargonList.tsx` *(baru)*
- `src/app/(dashboard)/internships/page.tsx` *(baru)*
- `src/app/(dashboard)/internships/[id]/page.tsx` *(baru)*

### Tugas
- [ ] Buat Route Handler tipis `src/app/api/internships/analyze/route.ts` (`export const maxDuration = 30`): verifikasi `requireAllowedUser`, validasi body dengan Zod, ambil daftar `Skill` eksisting user dari Supabase, panggil `analyzeInternshipInput`, simpan hasil secara atomik melalui PostgreSQL RPC `save_internship_analysis` (upsert `skills` baru dengan `mastery_score = 0`, `status = 'gap'`, `source = 'jd'`), lalu kembalikan `internshipId` tanpa menjalankan *Hybrid Sourcing*. Tangani error `429` dengan status HTTP & pesan ramah untuk tombol coba ulang.
- [ ] Buat `src/actions/internships.ts`: mutasi ubah status lamaran (`preparing | applied | interview | offer | rejected`) dan hapus `TargetInternship` via RLS + `revalidatePath`.
- [ ] Bangun UI `/internships` (`JDAnalyzerForm.tsx` 3 tab mode input dengan penghitung batas 15.000 karakter + `ReadinessCard.tsx` yang menghitung `ReadinessMeter` `2:1` via `src/lib/mastery.ts` + filter status lamaran).
- [ ] Bangun UI `/internships/[id]` menampilkan detail JD, matriks `Skill` (`must_have` vs `nice_to_have` beserta status `gap`/`learning`/`mastered`), tombol **Generate Capstone Track** (mengarah ke alur Fase 4), dan `JargonList.tsx` yang memanggil `saveToNoteAction` (dari Step 2.2) untuk tombol 1-klik **Save to Note** per istilah jargon.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal: submit JD di `/internships`, cek `target_internships` + `skills` + `internship_skills` tersimpan atomik, `ReadinessMeter` terhitung tepat, dan klik **Save to Note** pada salah satu entri `JargonGlossary` membuat draf catatan baru berformat `{{istilah}}`.

### Saran Conventional Commit
```text
feat(internships): add jd analyze endpoint, readiness meter UI, and jargon save-to-note
```

---

## Step 3.3 — Deep Service Hybrid Sourcing (`Promise.allSettled` + Timeout 4s + Cache 7 Hari)

- **Blocked by:** `Step 2.3`
- **What to build:** Membangun modul agregasi referensi `src/services/external/hybrid-sourcing.ts` bersama adapter Dev.to, Stack Exchange, dan Wikipedia/MDN yang bertahan terhadap kegagalan parsial API eksternal dan menegakkan cache 7 hari di tabel `curated_resources`.

### Daftar File
- `src/services/external/devto.ts` *(baru)*
- `src/services/external/hybrid-sourcing.ts` *(baru)*
- `src/services/external/__tests__/hybrid-sourcing.test.ts` *(baru)*

### Tugas
- [ ] Buat adapter `src/services/external/devto.ts` (pencarian artikel berdasarkan tag/slug `Skill` dengan `AbortSignal.timeout(4000)` dan *injected fetch* di *seam*).
- [ ] Bangun *deep module* `src/services/external/hybrid-sourcing.ts` (`getOrFetchCuratedResources({ skillId, skillName, skillSlug }, storeAdapter, sourceAdapters?)`):
  - Periksa cache `curated_resources` untuk `skillId` dengan `fetched_at >= NOW() - 7 days`; jika sudah ada, kembalikan langsung tanpa memanggil API eksternal.
  - Jika kosong/kedaluwarsa, panggil Dev.to, Stack Exchange, dan Wikipedia/MDN secara paralel memakai `Promise.allSettled` dengan timeout maks. 4 detik per sumber.
  - Gabungkan dan deduplikasi URL unik, lalu simpan ke `curated_resources` (`upsert` terhadap `UNIQUE (skill_id, url)`).
- [ ] Tulis `src/services/external/__tests__/hybrid-sourcing.test.ts` menggunakan *in-memory store adapter* dan *mock source adapters* untuk memverifikasi: hit cache < 7 hari (0 panggilan API), refresh saat > 7 hari, ketahanan saat 1–2 sumber gagal/timeout, dan deduplikasi URL.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`hybrid-sourcing.test.ts` hijau).
- [ ] Cek batas modul: `hybrid-sourcing.ts` tidak mengimpor modul Next.js maupun membuat instansi klien Supabase global secara hardcoded (menerima port/adapter penyimpanan lewat argumen).

### Saran Conventional Commit
```text
feat(sourcing): implement parallel hybrid sourcing service with 4s timeout and 7d cache
```

---

## Step 3.4 — Daily Engineering Digest Service, Vercel Cron Idempoten & Halaman `/digest`

- **Blocked by:** `Step 3.3`
- **What to build:** Menyelesaikan modul *Daily Engineering Digest* melalui adapter Hacker News + orkestrator `daily-digest.ts`, endpoint cron terproteksi `CRON_SECRET` di `vercel.json`, serta halaman `/digest` lengkap dengan tombol **Save to Note**.

### Daftar File
- `src/services/external/hackernews.ts` *(baru)*
- `src/services/external/daily-digest.ts` *(baru)*
- `src/services/external/__tests__/daily-digest.test.ts` *(baru)*
- `src/app/api/cron/daily-digest/route.ts` *(baru)*
- `src/actions/digest.ts` *(baru)*
- `src/app/(dashboard)/digest/page.tsx` *(baru)*
- `vercel.json` *(baru)*

### Tugas
- [ ] Buat `src/services/external/hackernews.ts` (mengambil *top stories* Hacker News Firebase API dengan batas *concurrency* ringan & timeout 4 detik) dan `src/services/external/daily-digest.ts` (`curateDailyDigestForUser(skills, adapters?)` yang mencocokkan 1–2 artikel Dev.to/HN terbaik terhadap `Skill` berstatus `gap` atau `learning` berdasarkan `tags`/judul).
- [ ] Tulis unit test `src/services/external/__tests__/daily-digest.test.ts` menggunakan adapter tiruan untuk memverifikasi pemilihan 1–2 artikel terbaik, pencocokan `matched_skill_id`, dan ketahanan saat salah satu sumber down.
- [ ] Buat Route Handler tipis `src/app/api/cron/daily-digest/route.ts`: validasi header `Authorization: Bearer <CRON_SECRET>` lewat `verifyCronSecret`, gunakan `createAdminClient` (`SUPABASE_SECRET_KEY`), tarik daftar user aktif + skill `gap`/`learning`, jalankan `curateDailyDigestForUser`, dan simpan ke `daily_digests` secara idempoten (`onConflict: 'user_id,source,external_id', ignoreDuplicates: true`).
- [ ] Tambahkan jadwal cron harian di `vercel.json` (`/api/cron/daily-digest`), buat `src/actions/digest.ts` (`markDigestReadAction`), dan bangun halaman `/digest` (filter `Skill` & status baca, tandai dibaca, serta tombol **Save to Note** memanggil `saveToNoteAction`).

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`daily-digest.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Verifikasi keamanan: `GET /api/cron/daily-digest` tanpa header `Authorization: Bearer <CRON_SECRET>` mengembalikan `401`; pemanggilan ulang dengan token valid di hari yang sama tidak menggandakan baris `daily_digests`.

### Saran Conventional Commit
```text
feat(digest): add daily engineering digest cron endpoint and digest archive page
```

---

## Handoff Log

- **2026-11-26 — Step 3.1 (Selesai & Di-commit):** Wrapper server-only `src/lib/gemini.ts` (Structured JSON Output, `GeminiRateLimitError` 429, maks. 1 *retry* ringan) serta *deep service* `src/services/ai/jd-analyzer.ts` + `jd-analyzer.test.ts` (4/4 test lulus, total 50/50 hijau). Lulus `tsc --noEmit`, `npm run lint`, dan `npm test`.
