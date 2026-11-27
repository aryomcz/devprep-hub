# Plan 08 — Voice Interview (Gemini Audio Multimodal) & AI Delivery Review

**Fase:** 8 dari 9 (Upgrade v1.1 Paket 3: Perekam Audio In-Memory Tanpa Supabase Storage, Transkrip & Evaluasi Gaya Penyampaian Gemini Audio)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) (`Bagian 12`) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-005`, `ADR-008`, `ADR-010`, `ADR-011`, `ADR-015`)  
**Aturan Seam (`/codebase-design`):** `src/lib/gemini.ts` menerima payload audio multimodal opsional (`inlineData`); `src/services/ai/interview-reviewer.ts` mengisolasi validasi audio (`MIME`, batas `3.5 MB`, durasi >3 detik) + prompt evaluasi dengan *injected AI adapter*; `/api/interview/review` memproses `FormData` secara *stateless in-memory* lalu membuang buffer audio tanpa menyentuh Supabase Storage; UI recorder (`VoiceInterviewRecorder`) & panel feedback (`InterviewAiFeedbackPanel`) dipisah dari `InterviewTimer.tsx` & `SpacedRepetitionQueue.tsx`.  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Step 8.1 — Migrasi `0008`, Kontrak Zod `InterviewAiFeedback`, & Dukungan `inlineData` di `gemini.ts`

- **Blocked by:** `Plan 05` (`0004_submit_interview_attempt_rpc.sql`)
- **What to build:** Memperluas tabel `interview_attempts` + RPC atomik `submit_interview_attempt` agar menerima `transcript` & `ai_feedback JSONB` opsional, menambah kontrak Zod `interviewAiFeedbackSchema`, dan memperluas `generateStructuredJson` untuk input audio multimodal `inlineData`.

### Daftar File
- `supabase/migrations/0008_interview_voice_review.sql` *(baru)*
- `src/types/database.ts` *(modifikasi: tambah `transcript` & `ai_feedback` di `interview_attempts` + argumen opsional di `submit_interview_attempt`)*
- `src/types/schemas.ts` *(modifikasi: tambah `interviewAiFeedbackSchema` & tipe `InterviewAiFeedback`)*
- `src/types/__tests__/schemas.test.ts` *(modifikasi: uji validasi `interviewAiFeedbackSchema`)*
- `src/lib/gemini.ts` *(modifikasi tipis: tambah `inlineData?: { mimeType: string; dataBase64: string }` pada `GenerateStructuredJsonOptions`)*
- `src/lib/__tests__/gemini.test.ts` *(baru — uji request multimodal `inline_data` + `text` dengan *mock fetch* tanpa jaringan)*

### Tugas
- [ ] Buat migrasi `supabase/migrations/0008_interview_voice_review.sql`:
  - `alter table public.interview_attempts add column if not exists transcript text, add column if not exists ai_feedback jsonb;`
  - Perbarui fungsi RPC `public.submit_interview_attempt` (mengikuti pola `0004_submit_interview_attempt_rpc.sql`) dengan 2 parameter opsional baru di akhir: `p_transcript text default null`, `p_ai_feedback jsonb default null`, dan sisipkan keduanya ke `public.interview_attempts`.
- [ ] Tambahkan `interviewAiFeedbackSchema` di `src/types/schemas.ts`:
  - `transcript` (string)
  - `content_review`: `{ definition_score (1..5), problem_score (1..5), tradeoffs_score (1..5), strengths[], missing_points[] }`
  - `delivery_review`: `{ clarity_score (1..5), structure_score (1..5), pacing_notes, filler_words: [{ word, count }], actionable_tips[] }`
  - `suggested_confidence`: `confidenceLevelSchema` (`'confused' | 'partial' | 'ready'`)
  - `confidence_reason`: string
- [ ] Perbarui `src/lib/gemini.ts` (`GenerateStructuredJsonOptions`):
  - Bila `options.inlineData` tersedia, sertakan `{ inline_data: { mime_type: options.inlineData.mimeType, data: options.inlineData.dataBase64 } }` di array `contents[0].parts` bersama `{ text: options.prompt }` tanpa memecah pemanggil teks yang sudah ada.
- [ ] Tulis `src/lib/__tests__/gemini.test.ts` menggunakan *mock `fetchFn`* untuk memverifikasi struktur body `inline_data` serta error handling `429` / JSON tidak valid.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`schemas.test.ts` & `gemini.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Pemanggil `generateStructuredJson` v1 yang ada tetap bekerja tanpa perubahan argumen.

### Saran Conventional Commit
```text
feat(interview): add 0008 voice review migration, ai feedback schema, and gemini inlineData support
```

---

## Step 8.2 — *Deep Service* `interview-reviewer.ts`, Endpoint `POST /api/interview/review`, & Action Extend

- **Blocked by:** `Step 8.1`
- **What to build:** Membangun layanan *stateless* review audio wawancara (`interview-reviewer.ts` + TDD test), Route Handler tipis `POST /api/interview/review` (*in-memory* tanpa Supabase Storage), serta memperluas `submitInterviewAttemptAction` agar menerima `transcript?` dan `aiFeedback?` opsional.

### Daftar File
- `src/services/ai/interview-reviewer.ts` *(baru)*
- `src/services/ai/__tests__/interview-reviewer.test.ts` *(baru)*
- `src/app/api/interview/review/route.ts` *(baru)*
- `src/actions/interview.ts` *(modifikasi: periksa & teruskan `transcript?` + `aiFeedback?` opsional ke RPC `submit_interview_attempt`)*

### Tugas
- [ ] Bangun *deep module* `src/services/ai/interview-reviewer.ts` (`reviewVoiceInterview(input, aiAdapter?)`) beserta unit test `interview-reviewer.test.ts`:
  - Validasi MIME dasar (mendukung varian codec seperti `audio/webm;codecs=opus` → normalisasi ke `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`), tolak tipe selain audio tersebut (`400`).
  - Validasi ukuran file audio maksimal **`3.5 * 1024 * 1024` byte (3.5 MB)** (`413` / `400`), tidak kosong, dan `durationSeconds > 3` detik (`400`).
  - Instruksikan Gemini mentranskrip jawaban campuran Bahasa Indonesia + istilah teknis Inggris apa adanya, mengevaluasi isi kerangka 3 poin *(Definisi, Masalah, Trade-off)*, menilai kejelasan & struktur alur bicara, menghitung daftar *filler words*, serta memberi `suggested_confidence`.
- [ ] Buat Route Handler tipis `src/app/api/interview/review/route.ts` (`export const maxDuration = 30`):
  - Wajib `requireAllowedUser()`.
  - Parse `FormData` (`audio`, `questionPrompt`, `skillName`, `durationSeconds`), konversi `File`/`Blob` ke `Buffer.from(await audio.arrayBuffer()).toString("base64")` *in-memory*, panggil `reviewVoiceInterview`, **jangan** simpan audio ke disk maupun Supabase Storage, kembalikan hasil JSON (termasuk mapping HTTP `429`).
- [ ] Perbarui `submitInterviewAttemptAction` di `src/actions/interview.ts`:
  - Tambahkan field opsional `transcript?: string | null` dan `aiFeedback?: InterviewAiFeedback | null` pada skema Zod dan teruskan ke RPC `submit_interview_attempt` (`p_transcript`, `p_ai_feedback`). Mode teks lama (`transcript = null`, `aiFeedback = null`) tetap berjalan identik.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`interview-reviewer.test.ts` hijau).
- [ ] `npm run build` lulus.
- [ ] Audit keamanan: tidak ada panggilan Supabase Storage dan buffer audio hanya hidup selama scope request.

### Saran Conventional Commit
```text
feat(interview): add stateless voice interview review service, api route, and action support
```

---

## Step 8.3 — Komponen `VoiceInterviewRecorder`, `InterviewAiFeedbackPanel` & Integrasi `/interview`

- **Blocked by:** `Step 8.2`
- **What to build:** Antarmuka perekam suara browser (`MediaRecorder` sinkron dengan timer 2 menit + playback lokal + fallback izin mic/`429`) serta panel hasil review AI yang mengisi/mengonfirmasi `confidence_level` sebelum disimpan ke `interview_attempts`.

### Daftar File
- `src/components/interview/VoiceInterviewRecorder.tsx` *(baru)*
- `src/components/interview/InterviewAiFeedbackPanel.tsx` *(baru)*
- `src/components/interview/InterviewTimer.tsx` *(modifikasi ringan: hubungkan mode Jawab Suara vs Teks + simpan `transcript` & `aiFeedback` lewat `submitInterviewAttemptAction`)*
- `src/app/(dashboard)/interview/page.tsx` *(modifikasi minimal: ikut select `transcript, ai_feedback` pada histori `interview_attempts`)*

### Tugas
- [ ] Bangun `src/components/interview/VoiceInterviewRecorder.tsx`:
  - Deteksi tipe MIME didukung `MediaRecorder` (`audio/webm;codecs=opus`, fallback `audio/mp4` untuk Safari) dengan `audioBitsPerSecond: 40000` (aman di bawah 3.5 MB untuk 120 detik).
  - Sinkron dengan countdown timer 120 detik (otomatis stop di batas 120 detik atau saat tombol Stop ditekan; validasi durasi >3 detik).
  - Tampilkan indikator rekam aksesibel (`aria-label` jelas pada tombol rekam/stop, badge `font-mono tabular-nums`), *audio preview playback* lokal (`URL.createObjectURL` + cleanup `revokeObjectURL`), tombol **"Evaluasi dengan Gemini Audio"**, dan banner fallback elegan bila izin mikrofon ditolak / `NotFoundError` / HTTP `429` (arahkan langsung ke input `<textarea>` tanpa kehilangan waktu/catatan sesi).
- [ ] Bangun `src/components/interview/InterviewAiFeedbackPanel.tsx`:
  - Tampilkan transkrip, skor kerangka 3 poin (`Definisi`, `Masalah`, `Trade-off`), skor **Kejelasan** & **Struktur Alur**, *pacing notes*, badge daftar ***Filler Words*** + frekuensi (`font-mono tabular-nums`), serta rekomendasi `suggested_confidence` + alasannya agar pengguna mudah mengonfirmasi salah satu tombol `confused | partial | ready`.
- [ ] Integrasikan keduanya ke `InterviewTimer.tsx` & `src/app/(dashboard)/interview/page.tsx`:
  - Sertakan opsi mode **Jawab dengan Suara** vs **Catatan Teks**, pra-isi `<textarea>` catatan dengan transkrip (bila disetujui/editable), dan tampilkan indikator riwayat sesi yang memiliki `ai_feedback` di daftar histori.

### Verification Checklist
- [ ] `npx tsc --noEmit` lulus dengan 0 error.
- [ ] `npm run lint` lulus dengan 0 error & 0 warning.
- [ ] `npm test` lulus 100%.
- [ ] `npm run build` produksi lulus tanpa error.
- [ ] Verifikasi lokal `/interview` di Light & Dark Mode: uji mode teks lama tetap utuh, uji UI perekam + error state izin mic/`429`, dan uji simpan `InterviewAttempt` beserta `ai_feedback`.

### Saran Conventional Commit
```text
feat(interview): add voice interview recorder and multimodal ai delivery feedback UI
```

---

## Handoff Log

*(Diisi setelah tiap sub-step lulus verifikasi dan disetujui pengguna.)*
