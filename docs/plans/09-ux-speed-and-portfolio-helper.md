# Plan 09 — UX Speed (`loading.tsx`, `Ctrl+K`) & Capstone CV/STAR Helper

**Fase:** 9 dari 9 (Upgrade v1.1 Paket 4: Route Loading Skeletons, Command Palette Ringan `Ctrl+K`, & Generator Bullet CV ATS + Cerita STAR Capstone)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) (`Bagian 12`) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-002`, `ADR-009`, `ADR-011`, `ADR-012`, `ADR-016`)  
**Aturan Seam (`/codebase-design`):** Skeleton memakai semantic tokens Light/Dark; `CommandPalette` memakai primitif `Dialog` `shadcn/ui` yang sudah ada + lazy-load `GET /api/search/command` (nol query tambahan di `DashboardLayout` dan nol LLM); `src/services/ai/portfolio-summarizer.ts` menerima *injected AI adapter* bebas primitif Next.js dan hasilnya di-cache permanen di `learning_tracks.portfolio_summary`.  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Step 9.1 — Primitif `Skeleton` & Route Loading Skeletons (`loading.tsx`)

- **Blocked by:** Fondasi v1.0 (`Batch 6A/6B` selesai)
- **What to build:** Menambahkan komponen dasar `src/components/ui/skeleton.tsx` serta berkas `loading.tsx` pada shell dashboard dan 3 rute dengan kueri terpadat agar transisi navigasi instan dan terasa responsif di Light maupun Dark Mode.

### Daftar File
- `src/components/ui/skeleton.tsx` *(baru)*
- `src/app/(dashboard)/loading.tsx` *(baru)*
- `src/app/(dashboard)/dashboard/loading.tsx` *(baru)*
- `src/app/(dashboard)/tracks/[id]/modules/[moduleId]/loading.tsx` *(baru)*
- `src/app/(dashboard)/internships/[id]/loading.tsx` *(baru)*

### Tugas
- [ ] Buat `src/components/ui/skeleton.tsx` sesuai pola `shadcn/ui` Tailwind v4 (`bg-muted animate-pulse rounded-md`).
- [ ] Buat `src/app/(dashboard)/loading.tsx` sebagai *fallback* generik berstruktur *PageHeader + card grid* memakai semantic tokens (`bg-card`, `border-border`, `bg-muted`).
- [ ] Buat skeleton spesifik yang mencerminkan *layout* akhir agar meminimalkan *layout shift* (CLS):
  - `src/app/(dashboard)/dashboard/loading.tsx` (kartu `Today's Focus` + 2 kolom `ReadinessOverview` & `MasteryChart`).
  - `src/app/(dashboard)/tracks/[id]/modules/[moduleId]/loading.tsx` (header modul + bar 4 tab + panel isi utama).
  - `src/app/(dashboard)/internships/[id]/loading.tsx` (kartu header `ReadinessMeter` + grid matriks skill & glosarium).

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [ ] `npm run build` lulus.
- [ ] Cek visual Light & Dark Mode: seluruh skeleton tampil halus dengan `prefers-reduced-motion` aman dan nol warna *hardcoded*.

### Saran Conventional Commit
```text
feat(ui): add skeleton primitive and route loading boundaries for dashboard and heavy pages
```

---

## Step 9.2 — Command Palette Ringan (`Ctrl+K` / `Cmd+K`) + `GET /api/search/command`

- **Blocked by:** `Step 9.1`
- **What to build:** Fitur pencarian & loncat cepat (`Ctrl+K` / `Cmd+K`) menuju halaman aplikasi, `Skill`, `Note`, `TargetInternship`, serta istilah `JargonGlossary` menggunakan `Dialog` `shadcn/ui` tanpa library pihak ketiga tambahan.

### Daftar File
- `src/app/api/search/command/route.ts` *(baru)*
- `src/components/layout/CommandPalette.tsx` *(baru)*
- `src/components/layout/MobileNav.tsx` *(modifikasi: tambahkan tombol pemicu pencarian cepat `Ctrl+K` di header & pasang `CommandPalette`)*

### Tugas
- [ ] Buat Route Handler baca ringan `src/app/api/search/command/route.ts` (`export const maxDuration = 30`):
  - Wajib `requireAllowedUser()`.
  - Ambil paralel via `Promise.all` (RLS user, limit ringkas per entitas): `skills` (`id, name, status`), `notes` (`id, title`), `target_internships` (`id, title, company_name, jargon_glossary`), dan `learning_tracks` (`id, capstone_title, status`).
  - Kembalikan JSON datar siap-cari (termasuk `JargonGlossary` dengan tautan ke `/internships/[id]`).
- [ ] Bangun `src/components/layout/CommandPalette.tsx` memakai `Dialog` + `Input` `shadcn/ui`:
  - Pintasan keyboard global `Ctrl+K` / `Cmd+K`, navigasi daftar hasil via panah atas/bawah + `Enter` + `Escape`, serta tombol bersihkan/tutup yang aksesibel (`aria-label`).
  - *Lazy-fetch* `/api/search/command` hanya saat dialog dibuka pertama kali (dengan *in-memory state cache* + tombol muat ulang bila perlu) agar `DashboardLayout` tidak menambah beban render awal.
- [ ] Tambahkan tombol pemicu **"Cari cepat... `Ctrl+K`"** yang rapi di `MobileNav.tsx` dan muat `CommandPalette`.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal: tekan `Ctrl+K`, cari halaman (`Quiz`, `Skills`), nama `Skill`, `Note`, atau istilah `JargonGlossary`, tekan `Enter`, dan pastikan navigasi langsung berpindah.

### Saran Conventional Commit
```text
feat(nav): add lightweight Ctrl+K command palette with lazy user-scoped search endpoint
```

---

## Step 9.3 — Migrasi `0009`, Capstone CV/STAR Summarizer & `PortfolioSummaryPanel`

- **Blocked by:** `Step 9.2` (atau independen setelah `0005` — ikuti urutan `main`)
- **What to build:** Mengonversi progres nyata *One-App Capstone* menjadi 3–4 *bullet point* CV ramah ATS (Bahasa Indonesia & Inggris) + draf cerita wawancara STAR 90 detik yang tersimpan permanen di `learning_tracks.portfolio_summary`.

### Daftar File
- `supabase/migrations/0009_track_portfolio_summary.sql` *(baru)*
- `src/types/database.ts` *(modifikasi: tambah `portfolio_summary: Json | null` di `learning_tracks`)*
- `src/types/schemas.ts` *(modifikasi: tambah `portfolioSummarySchema` & tipe `PortfolioSummary`)*
- `src/types/__tests__/schemas.test.ts` *(modifikasi: uji validasi `portfolioSummarySchema`)*
- `src/services/ai/portfolio-summarizer.ts` *(baru)*
- `src/services/ai/__tests__/portfolio-summarizer.test.ts` *(baru)*
- `src/app/api/tracks/[id]/portfolio-summary/route.ts` *(baru)*
- `src/components/tracks/PortfolioSummaryPanel.tsx` *(baru)*
- `src/app/(dashboard)/tracks/[id]/page.tsx` *(modifikasi: teruskan `portfolio_summary` & `completedModuleCount` ke `PortfolioSummaryPanel`)*

### Tugas
- [ ] Buat migrasi `supabase/migrations/0009_track_portfolio_summary.sql`:
  - `alter table public.learning_tracks add column if not exists portfolio_summary jsonb;`
- [ ] Tambahkan `portfolioSummarySchema` di `src/types/schemas.ts`:
  - `ats_bullets_id`: array 3–4 string berorientasi dampak + metrik/konteks arsitektur.
  - `ats_bullets_en`: array 3–4 string ramah ATS berbahasa Inggris.
  - `star_story`: `{ situation, task, action, result, script_90s }` (Bahasa Indonesia terstruktur siap latihan 90 detik).
- [ ] Bangun *deep module* `src/services/ai/portfolio-summarizer.ts` (`summarizeTrackPortfolio(input, aiAdapter?)`) + `portfolio-summarizer.test.ts`:
  - Terima metadata `LearningTrack`, daftar modul yang sudah `completed`, dan ringkasan `LabSubmission` lulus bila tersedia; validasi keluaran dengan `portfolioSummarySchema`.
- [ ] Buat Route Handler tipis `src/app/api/tracks/[id]/portfolio-summary/route.ts` (`export const maxDuration = 30`):
  - Cek `requireAllowedUser()`, kepemilikan `learning_tracks`, dan **pastikan minimal 1 modul berstatus `completed`** (kembalikan `400` jika belum ada).
  - **Idempoten:** jika `portfolio_summary` sudah ada di DB (kecuali ada konfirmasi `forceRefresh`), langsung kembalikan dari cache PostgreSQL; jika baru di-generate, simpan permanen ke `learning_tracks.portfolio_summary` + `revalidatePath('/tracks/[id]')`.
- [ ] Bangun `src/components/tracks/PortfolioSummaryPanel.tsx` dan pasang di `src/app/(dashboard)/tracks/[id]/page.tsx`:
  - Tombol **"Generate Bullet CV & Cerita STAR"** (nonaktif dengan petunjuk jelas sebelum ≥1 modul `completed`), tampilan terpisah tab/blok **Bullet CV ATS (ID & EN)** serta **Cerita STAR 90 Detik**, lengkap dengan tombol **Salin** 1-klik (`navigator.clipboard.writeText` + umpan balik tersalin) dan penanganan `429`.

### Verification Checklist
- [ ] `npx tsc --noEmit` lulus dengan 0 error.
- [ ] `npm run lint` lulus dengan 0 error & 0 warning.
- [ ] `npm test` lulus 100% (`portfolio-summarizer.test.ts` & seluruh suite hijau).
- [ ] `npm run build` produksi lulus tanpa error.
- [ ] Verifikasi lokal `/tracks/[id]` di Light & Dark Mode: tombol terkunci saat 0 modul selesai; aktif setelah ≥1 modul selesai, tersimpan permanen di DB setelah refresh, dan tombol salin bekerja.

### Saran Conventional Commit
```text
feat(tracks): add capstone ATS CV bullet & STAR story summarizer with permanent DB cache
```

---

## Handoff Log

*(Diisi setelah tiap sub-step lulus verifikasi dan disetujui pengguna.)*
