# Plan 01 — Foundation, Auth, & Master Skills

**Fase:** 1 dari 5 (Fondasi Database, Autentikasi, *Single-User Gate*, & Master `Skill`)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-001`–`ADR-011`)  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi verifikasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Arsitektur Seam & Arah Dependensi 4 Lapisan (`ADR-011` / `/codebase-design`)

Seluruh kode yang ditulis pada Plan 01 s.d. 05 wajib menjaga aliran dependensi **satu arah** berikut:

```text
UI (src/app/(dashboard)/**, src/components/**)
   ├──▶ src/actions/**       (Mutasi CRUD DB via RLS + revalidatePath; DILARANG memanggil LLM / Public API)
   └──▶ src/app/api/**       (HTTP Adapter tipis: maxDuration, auth/cron guard, cache check, delegasi)
            └──▶ src/services/{external,ai}/**  (Deep modules I/O eksternal; injected adapter seam; bebas Next.js primitives)
                     └──▶ src/lib/**            (Pure in-process domain modules & thin client factories; bebas NextRequest/UI)
                              └──▶ src/types/** (Canonical TS types & Zod schemas)
```

| Lapisan | Tanggung Jawab (Owns) | Dilarang Keras (Never Imports/Does) | Cara Pengujian (*Seam*) |
| :--- | :--- | :--- | :--- |
| **`src/lib/`** | Modul komputasi murni *in-process* (`skill-normalizer`, `mastery`, `cloze-parser`, `spaced-repetition`, `diff-sanitizer`, `todays-focus`, `utils` (`cn`)) + *factory* tipis (`supabase`, `gemini`, `auth-guard`). | I/O HTTP eksternal langsung pada modul domain murni, `next/cache` (`revalidatePath`), atau komponen UI React. | Direct unit test tanpa mock (atau pure arg injection). |
| **`src/services/`** | *Deep modules* orkestrasi panggilan Gemini (`ai/`) & Public API (`external/`), timeout 4 detik, validasi Zod, serta penyaringan payload. | `NextRequest`, `NextResponse`, `cookies()`, `headers()`, `revalidatePath`, atau query UI langsung. | Uji via *injected adapter* (`fetch` / AI adapter tiruan) di *seam* interface. |
| **`src/actions/`** | Next.js Server Actions terautentikasi untuk mutasi CRUD DB via `@supabase/ssr` (RLS aktif) + `revalidatePath`. | Memanggil Gemini API, GitHub/Dev.to/HN API langsung, atau membocorkan `SUPABASE_SECRET_KEY`. | Uji logika via pure helpers + kontrak Zod + integrasi DB/RLS. |
| **`src/app/api/`** | HTTP *adapter* tipis (`export const maxDuration`), cek `requireAllowedUser` / `CRON_SECRET`, baca/tulis cache DB, dan panggil `src/services/`. | Menanam logika bisnis *parsing*/kalkulasi skor panjang langsung di dalam `route.ts`. | Integrasi HTTP handler + verifikasi guard auth/cron. |

---

## Step 1.1 — Fondasi Skema Database, Migrasi SQL, RLS Penuh & Kontrak Tipe

- **Blocked by:** `None (can start immediately)`
- **What to build:** Menyiapkan dependensi proyek, test runner (`vitest`), template `.env.example`, migrasi SQL terversi lengkap (14 enum, 13 tabel sesuai `GLOSSARY.md` & `PRD.md`, RLS penuh, trigger `profiles`, serta fungsi PostgreSQL RPC), *generated/canonical database types*, dan kontrak Zod untuk seluruh kolom `JSONB` serta payload API.

### Daftar File
- `package.json` *(modifikasi: tambah dependensi & script `"test": "vitest run"`)*
- `vitest.config.ts` *(baru)*
- `.env.example` *(baru — nilai kosong untuk 7 variabel)*
- `supabase/migrations/0001_initial_schema_and_rls.sql` *(baru)*
- `src/types/database.ts` *(baru)*
- `src/types/schemas.ts` *(baru)*
- `src/types/__tests__/schemas.test.ts` *(baru)*

### Tugas
- [x] Instal paket inti: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-react`, serta devDependency `vitest` (dan `@vitest/coverage-v8` bila diperlukan).
- [x] Tambahkan script `"test": "vitest run"` di `package.json` dan buat `vitest.config.ts` dengan alias path `@/*` selaras `tsconfig.json`.
- [x] Buat `.env.example` berisi tepat 7 variabel tanpa nilai rahasia: `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, `SUPABASE_SECRET_KEY=`, `GEMINI_API_KEY=`, `GITHUB_TOKEN=`, `CRON_SECRET=`, `ALLOWED_USER_EMAIL=`.
- [x] Tulis `supabase/migrations/0001_initial_schema_and_rls.sql` mencakup:
  - 14 enum kanonik sesuai `GLOSSARY.md` (`skill_category`, `skill_status`, `skill_source`, `internship_status`, `skill_priority`, `resource_source`, `track_status`, `module_type`, `module_status`, `module_content_status`, `digest_source`, `quiz_source_type`, `interview_card_source`, `confidence_level`).
  - 13 tabel (`profiles`, `skills`, `target_internships`, `internship_skills`, `curated_resources`, `learning_tracks`, `track_modules`, `lab_submissions`, `daily_digests`, `notes`, `quiz_attempts`, `interview_cards`, `interview_attempts`) lengkap dengan seluruh index, `UNIQUE (user_id, slug)` pada `skills`, `UNIQUE (skill_id, url)` pada `curated_resources`, dan `UNIQUE (user_id, source, external_id)` pada `daily_digests`.
  - Trigger otomatis pembuatan baris `profiles` saat user baru dibuat di `auth.users`.
  - `ENABLE ROW LEVEL SECURITY` dan policy kepemilikan (`auth.uid()`) pada seluruh 13 tabel.
  - PostgreSQL RPC `save_internship_analysis(...)` (atomik menyimpan `target_internships`, upsert `skills`, & mapping `internship_skills`) serta `merge_skills(p_source_skill_id, p_target_skill_id)` (memindahkan semua relasi anak secara atomik dan menghapus skill sumber).
- [x] Buat `src/types/database.ts` yang merepresentasikan skema PostgreSQL di atas secara ketat, dan `src/types/schemas.ts` berisi skema Zod untuk seluruh kolom `JSONB` (`JargonEntry`, `ConceptBrief`, `WarmupDrill`, `HandsOnTicket`, `AiReviewFeedback`) dan input API.
- [x] Tulis unit test kontrak di `src/types/__tests__/schemas.test.ts` yang memverifikasi validasi payload valid maupun penolakan struktur `JSONB`/enum yang cacat.

### Verification Checklist
- [x] `npx tsc --noEmit` lulus tanpa error.
- [x] `npm run lint` lulus tanpa warning/error baru.
- [x] `npm test` menjalankan `schemas.test.ts` dan seluruh kasus lulus.
- [x] Pemeriksaan manual memastikan seluruh 13 nama tabel dan 40 literal enum di `0001_initial_schema_and_rls.sql`, `database.ts`, dan `schemas.ts` persis sama dengan `docs/GLOSSARY.md`.

### Saran Conventional Commit
```text
feat(db): add initial supabase schema migration, rls policies, and zod contracts
```

---

## Step 1.2 — Supabase SSR Clients, Next.js 16 `src/proxy.ts`, Single-User Gate & Shell Navigasi

- **Blocked by:** `Step 1.1`
- **What to build:** Menghubungkan aplikasi ke Supabase Auth dengan konvensi Next.js 16 (`src/proxy.ts`), menegakkan *Single-User Gate* (`ALLOWED_USER_EMAIL`), halaman `/login`, dan shell layout terproteksi `(dashboard)/layout.tsx`.

### Daftar File
- `components.json` *(baru/diinisialisasi via `npx shadcn@latest init`)*
- `src/lib/utils.ts` *(baru — helper `cn` untuk `shadcn/ui`)*
- `src/app/globals.css` *(modifikasi — token CSS variables `shadcn/ui` Tailwind v4)*
- `src/lib/supabase/client.ts` *(baru)*
- `src/lib/supabase/server.ts` *(baru)*
- `src/lib/supabase/proxy.ts` *(baru)*
- `src/lib/auth-guard.ts` *(baru)*
- `src/lib/__tests__/auth-guard.test.ts` *(baru)*
- `src/proxy.ts` *(baru)*
- `src/app/(auth)/login/page.tsx` *(baru)*
- `src/components/ui/` *(baru — komponen `shadcn/ui`: `button`, `card`, `badge`, `dialog`, `tabs`, `input`, `textarea`, `select`, `sheet`, `tooltip`, `progress`, `separator`)*
- `src/components/layout/` *(baru — `Sidebar.tsx`, `MobileNav.tsx`, `PageHeader.tsx`)*
- `src/app/(dashboard)/layout.tsx` *(baru)*
- `src/app/(dashboard)/dashboard/page.tsx` *(baru — placeholder shell terproteksi)*

### Tugas
- [ ] Pastikan `shadcn/ui` terinisialisasi (`components.json`, `src/lib/utils.ts`, token CSS variables di `src/app/globals.css`) dan komponen dasar (`button`, `card`, `badge`, `dialog`, `tabs`, `input`, `textarea`, `select`, `sheet`, `tooltip`, `progress`, `separator`) tersedia di `src/components/ui/`.
- [ ] Buat *factory* klien Supabase di `src/lib/supabase/client.ts` (`createBrowserClient` dengan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `src/lib/supabase/server.ts` (`createServerClient` berbasis `cookies()` Next.js 16 async + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), dan helper refresh sesi `src/lib/supabase/proxy.ts` (serta helper `createAdminClient` dengan `SUPABASE_SECRET_KEY` khusus server-only untuk cron).
- [ ] Buat *pure guard module* `src/lib/auth-guard.ts` (`isAllowedEmail`, `requireAllowedUser`, dan `verifyCronSecret` dengan perbandingan konstan waktu) beserta unit test `src/lib/__tests__/auth-guard.test.ts` (menguji email cocok, email berbeda, env kosong, dan header Bearer cron).
- [ ] Implementasikan `src/proxy.ts` (ekspor fungsi `proxy` + `config.matcher` mengecualikan asset statis & `/api/cron/*`) untuk me-refresh sesi Supabase dan mengalihkan request tidak terautentikasi / tidak lolos `ALLOWED_USER_EMAIL` ke `/login`.
- [ ] Buat halaman `/login` mendukung login Email/Password maupun GitHub OAuth via Supabase Auth (tanpa tombol registrasi publik).
- [ ] Bangun komponen shell `src/components/layout/{Sidebar,MobileNav,PageHeader}.tsx` berbasis komponen `shadcn/ui`, serta `src/app/(dashboard)/layout.tsx` yang memverifikasi `requireAllowedUser()` di server sebelum merender konten rute privat.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [ ] `npm run build` berhasil tanpa deprecation warning terkait routing/proxy Next.js 16.
- [ ] Verifikasi lokal: akses `/dashboard` tanpa sesi redirect ke `/login`; login dengan email di luar `ALLOWED_USER_EMAIL` ditolak; `src/lib/auth-guard.ts` teruji lewat unit test.

### Saran Conventional Commit
```text
feat(auth): implement next 16 proxy, single-user email gate, and dashboard shell
```

---

## Step 1.3 — Modul Domain `skill-normalizer` & `mastery`, Server Actions & Halaman `/skills` (+ Merge Skill)

- **Blocked by:** `Step 1.2`
- **What to build:** Membangun modul domain murni *in-process* untuk normalisasi nama/alias `Skill` dan kalkulasi `MasteryScore` dinamis + `ReadinessMeter`, Server Actions CRUD & `Merge Skill`, serta direktori `/skills` yang fungsional end-to-end.

### Daftar File
- `src/lib/skill-normalizer.ts` *(baru)*
- `src/lib/__tests__/skill-normalizer.test.ts` *(baru)*
- `src/lib/mastery.ts` *(baru)*
- `src/lib/__tests__/mastery.test.ts` *(baru)*
- `src/actions/skills.ts` *(baru)*
- `src/components/skills/SkillTable.tsx` *(baru)*
- `src/components/skills/MergeSkillDialog.tsx` *(baru)*
- `src/app/(dashboard)/skills/page.tsx` *(baru)*

### Tugas
- [ ] Bangun `src/lib/skill-normalizer.ts` dengan TDD (`skill-normalizer.test.ts`): tangani simbol khusus lebih dulu (`c++ → cpp`, `c# → csharp`, `.net → dotnet`, `f# → fsharp`), normalisasi spasi/titik (`Next.js` / `NextJS` → `nextjs`), serta kamus alias terkurasi (`postgres → postgresql`, `js → javascript`, `ts → typescript`, `k8s → kubernetes`, dll.) menghasilkan `{ canonicalName, slug }`.
- [ ] Bangun `src/lib/mastery.ts` dengan TDD (`mastery.test.ts`):
  - `deriveSkillStatus(score)` (`0–29 gap`, `30–79 learning`, `80–100 mastered`).
  - `calculateMasteryBreakdown({ source, quizScores, labPassed, labSubmitted, latestConfidence })`: bobot dasar `Quiz 30 / Lab 40 / Interview 30`, *baseline* `40` (`github`) vs `0` (`jd`/`manual`), *cap* `65` jika baru 1 sinyal aktif (`max(40, skor)` untuk GitHub), renormalisasi ke `100%` jika ≥2 sinyal aktif, dan pengembalian objek rincian `{ score, status, breakdown: { quiz, lab, interview }, capped }`.
  - `calculateReadinessMeter(items)` dengan bobot `must_have = 2 : nice_to_have = 1`.
- [ ] Buat `src/actions/skills.ts` (lapisan `actions`: cek sesi via `requireAllowedUser`, normalisasi via `skill-normalizer.ts`, CRUD manual, *override* skor manual `mastery_score`, dan `mergeSkillsAction` yang memanggil PostgreSQL RPC `merge_skills` lalu `revalidatePath('/skills')`).
- [ ] Bangun UI `/skills` dengan `SkillTable.tsx` (filter kategori/status, badge status, tooltip rincian Q/L/I & status *cap*, form tambah/edit manual, *override* skor) dan `MergeSkillDialog.tsx` untuk menggabungkan 2 skill duplikat.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (seluruh tabel kasus `skill-normalizer.test.ts` & `mastery.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Cek batas modul: `src/lib/skill-normalizer.ts` dan `src/lib/mastery.ts` tidak mengimpor modul Next.js, Supabase, atau UI.

### Saran Conventional Commit
```text
feat(skills): add skill normalizer, dynamic mastery calculator, and skills directory
```

---

## Step 1.4 — Deep Service GitHub Sync & Endpoint `POST /api/github/sync`

- **Blocked by:** `Step 1.3`
- **What to build:** Mengintegrasikan GitHub REST API di `src/services/external/github.ts` melalui *seam* adapter yang dapat diuji tanpa jaringan, mengekspos Route Handler `POST /api/github/sync`, dan menyambungkan tombol **Sync GitHub** di halaman `/skills`.

### Daftar File
- `src/services/external/github.ts` *(baru)*
- `src/services/external/__tests__/github.test.ts` *(baru)*
- `src/app/api/github/sync/route.ts` *(baru)*
- `src/components/skills/SkillTable.tsx` *(modifikasi: tambah tombol & status Sync GitHub)*

### Tugas
- [ ] Bangun *deep module* `src/services/external/github.ts`: ekspor `fetchUserGithubSkills(username, options)` dengan *injected fetch adapter* pada *seam* argumen, batas ketat **maks. 20 repo publik non-fork terbaru** (`sort=updated`, `type=owner`), timeout `AbortSignal.timeout(4000)`, ekstraksi bahasa utama + `topics` + dependensi manifes umum (misal `package.json`), lalu normalisasi setiap item memakai `src/lib/skill-normalizer.ts`.
- [ ] Tulis `src/services/external/__tests__/github.test.ts` menggunakan mock fetch adapter untuk memverifikasi: pemfilteran repo fork, pembatasan maks. 20 repo, deduplikasi hasil ekstraksi, dan penanganan error/rate-limit GitHub API.
- [ ] Buat Route Handler tipis `src/app/api/github/sync/route.ts`: validasi `requireAllowedUser`, baca `GITHUB_TOKEN` di sisi server, panggil `fetchUserGithubSkills`, *upsert* `Skill` baru dengan `source = 'github'`, `mastery_score = 40`, `status = 'learning'` (tanpa menurunkan `mastery_score` skill yang sudah lebih tinggi), dan perbarui `profiles.github_username` + `profiles.last_github_sync`.
- [ ] Sambungkan form/tombol **Sync GitHub** di `/skills` untuk memicu `POST /api/github/sync` dan menampilkan `last_github_sync` beserta jumlah skill baru yang terpetakan.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`github.test.ts` hijau tanpa panggilan jaringan asli).
- [ ] `npm run build` lulus.
- [ ] Cek keamanan: `GITHUB_TOKEN` hanya dibaca di server (`route.ts` / `services/external/github.ts`) dan `src/services/external/github.ts` bersih dari import Next.js.

### Saran Conventional Commit
```text
feat(github): add github repository sync service and route handler
```

---

## Handoff Log

- **2026-11-25 — Step 1.1 (Selesai & Di-commit):** Migrasi SQL `supabase/migrations/0001_initial_schema_and_rls.sql` (14 enum, 13 tabel, RLS penuh, trigger `profiles`, RPC `save_internship_analysis` & `merge_skills`), kontrak TypeScript `src/types/database.ts`, kontrak Zod `src/types/schemas.ts`, unit test `src/types/__tests__/schemas.test.ts` (5/5 lulus), `vitest.config.ts`, dan `.env.example` (diperbarui ke `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` & `SUPABASE_SECRET_KEY`). Lulus `tsc --noEmit`, `npm run lint`, dan `npm test`.
