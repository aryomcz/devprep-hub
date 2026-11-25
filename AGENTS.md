<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

Project Rules — DevPrep Hub

1. Project Context & Source of Truth

App: DevPrep Hub (Personal Engineering Readiness Hub).

Stack: Next.js (App Router, TypeScript), Tailwind CSS, Supabase (PostgreSQL + Auth + RLS), Zod, Google Gemini API (Free Tier), Vercel Hobby + Vercel Cron.

Always read before coding:

docs/PRD.md (spesifikasi produk & skema utama)

docs/GLOSSARY.md (penamaan entitas wajib konsisten di DB, TypeScript, API, dan UI)

docs/DECISIONS.md (keputusan arsitektur yang sudah dikunci)

2. Verification Commands

Typecheck: npx tsc --noEmit

Lint: npm run lint

Test: npm test (jika test runner sudah terpasang)

Build: npm run build

3. Execution & Control Protocol (STRICT)

One Sub-Step Only: Kerjakan hanya satu sub-step (Checkpoint) dalam satu waktu dari file docs/plans/XX.md yang sedang aktif.

STOP & Wait: Setelah 1 sub-step selesai, berhenti. Ringkas file yang dibuat/diubah dan berikan cara verifikasinya, lalu tunggu persetujuan pengguna sebelum lanjut ke sub-step berikutnya.

Human-Controlled Git: DILARANG menjalankan git commit, git push, git reset, atau perintah Git destruktif secara otomatis. Cukup sarankan pesan Conventional Commit setelah verifikasi lulus.

Living Docs: Setelah pengguna mengonfirmasi sub-step lulus verifikasi, centang [x] dan perbarui bagian Handoff Log di file docs/plans/XX.md yang aktif.

Log Decisions: Catat setiap perubahan atau keputusan arsitektur penting ke docs/DECISIONS.md (ringkas, maksimal 5–7 baris per entri).

4. Security & Free-Tier Guardrails

Zero Hardcoded Secrets: Jangan pernah menulis API key, token, atau URL rahasia di dalam kode maupun file dokumentasi.

Server-Only Boundaries: Variabel GEMINI_API_KEY, SUPABASE_SECRET_KEY, GITHUB_TOKEN, dan CRON_SECRET hanya boleh diakses di sisi server (Route Handlers, Server Actions, atau src/services/). Dilarang memanggil LLM atau Public API ber-token langsung dari Client Components.

Env Sync: Setiap kali menambah variabel lingkungan baru, wajib daftarkan namanya (dengan nilai kosong) di .env.example.

Cron Protection: Seluruh endpoint di src/app/api/cron/\* wajib memvalidasi header Authorization: Bearer <CRON_SECRET>.

Database Safety: Semua perubahan skema tabel, index, dan kebijakan RLS wajib disimpan sebagai file migrasi terversi (bukan perubahan manual tanpa jejak).

Resilience & Caching: Gunakan Promise.allSettled dengan timeout ketat (maks. 4 detik per sumber) saat memanggil beberapa Public API secara paralel. Terapkan prinsip Generate Once, Cache Forever di PostgreSQL (JSONB) agar tidak memanggil Gemini API secara berulang di halaman baca.

<!-- END:nextjs-agent-rules -->
