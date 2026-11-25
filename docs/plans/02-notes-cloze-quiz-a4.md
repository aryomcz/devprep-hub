# Plan 02 — Smart Notes, Cloze Quiz, Quick Lookup & Export A4

**Fase:** 2 dari 5 (Catatan Markdown, Parser *Cloze* Deterministik, *Quick Lookup*, Kuis *Active Recall*, & Cetak A4)  
**Sumber Kebenaran:** [PRD.md](../PRD.md) | [GLOSSARY.md](../GLOSSARY.md) | [DECISIONS.md](../DECISIONS.md) (`ADR-004`, `ADR-009`, `ADR-011`)  
**Aturan Seam (`/codebase-design`):** `src/lib/cloze-parser.ts` adalah modul murni *in-process*; `src/actions/notes.ts` & `quiz.ts` hanya mengelola mutasi DB/RLS + `revalidatePath`; panggilan Public API *Quick Lookup* terisolasi di `src/services/external/` dengan *injected fetch adapter* di *seam*-nya.  
**Aturan Eksekusi:** Kerjakan **1 sub-step saja** dalam satu waktu, lalu **STOP** dan tunggu konfirmasi pengguna sebelum mencentang `[x]` dan lanjut ke sub-step berikutnya.

---

## Step 2.1 — State-Aware Cloze Parser (`src/lib/cloze-parser.ts`) dengan TDD

- **Blocked by:** `Step 1.1`
- **What to build:** Membangun modul domain deterministik *in-process* untuk mengekstrak `ClozeItem` dari Markdown catatan tanpa merusak sintaks JSX/GitHub Actions/template di dalam blok kode, sekaligus menyediakan fungsi penilaian jawaban.

### Daftar File
- `src/lib/cloze-parser.ts` *(baru)*
- `src/lib/__tests__/cloze-parser.test.ts` *(baru)*

### Tugas
- [ ] Tulis unit test (`tdd`) terlebih dahulu di `src/lib/__tests__/cloze-parser.test.ts` yang mencakup seluruh *edge case* `ADR-004`:
  - Prosa biasa: `{{jawaban}}` dan `{{jawaban::petunjuk}}`.
  - Escape literal: `\{\{bukan_cloze\}\}` tetap dirender sebagai `{{bukan_cloze}}` tanpa menjadi soal.
  - Blok kode *fenced* (` ```...``` `, `~~~...~~~`) & *inline code* (`` `...` ``): `{{...}}` di dalamnya **diabaikan** agar JSX (`style={{ color: 'red' }}`), GitHub Actions (`${{ secrets.TOKEN }}`), dan Mustache aman.
  - Opt-in eksplisit di dalam kode: `{{cloze:jawaban}}` dan `{{cloze:jawaban::petunjuk}}` diekstrak sebagai soal.
  - Penolakan: `{{}}` kosong, `{{   }}` hanya spasi, dan *cloze* lintas baris (*multiline*) tidak dianggap soal.
  - Evaluasi jawaban (`evaluateClozeAnswer`): *trim* spasi berlebih, normalisasi spasi ganda, *case-insensitive* untuk prosa dan sensitivitas opsi untuk *cloze* dari kode.
- [ ] Implementasikan `parseClozeMarkdown(markdown)` (menghasilkan `{ items: ClozeItem[], renderedPrompt, clozeCount }`) dan `evaluateClozeAnswer(userInput, expectedAnswer, isCodeCloze)` secara *state-aware* (melacak state *fenced code block* & *inline backtick*) di `src/lib/cloze-parser.ts`.

### Verification Checklist
- [ ] `npx tsc --noEmit` dan `npm run lint` lulus.
- [ ] `npm test` menjalankan seluruh kasus `cloze-parser.test.ts` dan lulus 100%.
- [ ] `src/lib/cloze-parser.ts` tidak memiliki dependensi I/O, React, ataupun Next.js.

### Saran Conventional Commit
```text
feat(cloze): implement state-aware markdown cloze parser with code block safety
```

---

## Step 2.2 — CRUD Smart Notes, Monospace Editor, Cloze Toolbar & Unified Save-to-Note Action

- **Blocked by:** `Step 1.3`, `Step 2.1`
- **What to build:** Membangun Server Actions `Note` (termasuk aksi terpadu *Save to Note* yang dapat dipanggil dari *Daily Digest*, *Jargon Glossary*, dan *Concept Brief*), halaman daftar `/notes`, serta editor `/notes/[id]` berbasis `<textarea>` monospace ringan (`ADR-009`).

### Daftar File
- `src/actions/notes.ts` *(baru)*
- `src/components/notes/MarkdownEditor.tsx` *(baru)*
- `src/app/(dashboard)/notes/page.tsx` *(baru)*
- `src/app/(dashboard)/notes/[id]/page.tsx` *(baru)*

### Tugas
- [ ] Buat `src/actions/notes.ts` (semua tervalidasi Zod & `requireAllowedUser` via RLS):
  - `createNoteAction`, `updateNoteAction`, `deleteNoteAction`.
  - `saveToNoteAction({ title, term, definition, sourceLabel, skillId? })`: membuat atau menambahkan bagian catatan baru dengan format `{{term}}` siap pakai untuk kuis *cloze* dan mengembalikan `noteId` untuk navigasi cepat.
- [ ] Bangun halaman `/notes` yang menampilkan daftar `Note` dikelompokkan berdasarkan `Skill`, filter pencarian judul/skill, dan indikator jumlah soal `ClozeItem` hasil `parseClozeMarkdown`.
- [ ] Bangun `src/components/notes/MarkdownEditor.tsx` sesuai `ADR-009` (tanpa Monaco/CodeMirror):
  - `<textarea>` monospace terkontrol yang mendeteksi posisi seleksi teks.
  - Tombol toolbar **"Jadikan Cloze `{{...}}`"** dan **"Cloze Kode `{{cloze:...}}`"** untuk membungkus teks terseleksi secara instan.
  - Panel *live preview* Markdown bersih (dengan highlight visual pada bagian *cloze*) + tombol **Simpan**, **Mulai Kuis Cloze**, dan **Export A4**.
- [ ] Bangun `/notes/[id]/page.tsx` untuk memuat catatan berdasarkan `id`, mengubah tautan `skill_id`, dan menghubungkan `MarkdownEditor`.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal: buat catatan baru, pilih kata lalu klik tombol Cloze toolbar, simpan, pastikan jumlah soal Cloze di `/notes` bertambah sesuai hasil parser.

### Saran Conventional Commit
```text
feat(notes): add markdown note editor, cloze toolbar, and unified save-to-note action
```

---

## Step 2.3 — Deep Service Quick Lookup (Wikipedia / MDN / Stack Exchange) & Drawer Referensi

- **Blocked by:** `Step 2.2`
- **What to build:** Membangun modul layanan eksternal *Quick Lookup* di `src/services/external/` dengan *timeout* 4 detik dan toleransi kegagalan parsial (`Promise.allSettled`), Route Handler `/api/resources/lookup`, serta drawer panel samping di editor `/notes/[id]`.

### Daftar File
- `src/services/external/wikipedia.ts` *(baru)*
- `src/services/external/stackexchange.ts` *(baru)*
- `src/services/external/lookup.ts` *(baru)*
- `src/services/external/__tests__/lookup.test.ts` *(baru)*
- `src/app/api/resources/lookup/route.ts` *(baru)*
- `src/components/notes/QuickLookupDrawer.tsx` *(baru)*
- `src/components/notes/MarkdownEditor.tsx` *(modifikasi: tombol buka QuickLookupDrawer & sisip kutipan ke editor)*

### Tugas
- [ ] Buat adapter sumber `src/services/external/wikipedia.ts` (Wikipedia REST summary + MDN search API dengan timeout 4 detik) dan `src/services/external/stackexchange.ts` (pertanyaan *top-voted* Stack Overflow dengan timeout 4 detik); keduanya menerima *injected fetch* pada *seam* pengujian.
- [ ] Buat modul orkestrasi `src/services/external/lookup.ts` (`lookupTechnicalTerm(query, adapters?)`) yang menjalankan panggilan paralel lewat `Promise.allSettled`, menormalisasi hasil menjadi `{ source, title, url, summary }`, dan tetap mengembalikan sumber yang sukses bila salah satu API gagal/timeout.
- [ ] Tulis unit test `src/services/external/__tests__/lookup.test.ts` (memverifikasi kegagalan parsial, timeout 4 detik, dan sanitasi query kosong).
- [ ] Buat Route Handler tipis `src/app/api/resources/lookup/route.ts` (cek `requireAllowedUser`, validasi query `q`, panggil `lookupTechnicalTerm`).
- [ ] Buat `src/components/notes/QuickLookupDrawer.tsx` dan hubungkan ke `MarkdownEditor` agar pengguna dapat mencari istilah dari editor catatan lalu menyisipkan ringkasan + tautan referensi langsung ke Markdown.

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus (`lookup.test.ts` hijau tanpa jaringan).
- [ ] `npm run build` lulus.
- [ ] Cek batas modul: `src/services/external/*` bebas dari import `next/server` atau komponen React.

### Saran Conventional Commit
```text
feat(notes): add parallel quick lookup service and reference drawer
```

---

## Step 2.4 — Active Recall Cloze Quiz Runner, Rekaman `QuizAttempt`, Update `MasteryScore` & Export A4

- **Blocked by:** `Step 2.2`
- **What to build:** Menuntaskan siklus belajar *Notes → Active Recall → Mastery → Print PDF* melalui `ClozeQuizRunner`, penyimpanan `quiz_attempts` + pembaruan otomatis `MasteryScore` `Skill`, serta halaman cetak 2 kolom A4.

### Daftar File
- `src/actions/quiz.ts` *(baru)*
- `src/components/quiz/ClozeQuizRunner.tsx` *(baru)*
- `src/app/(dashboard)/quiz/page.tsx` *(baru)*
- `src/components/notes/A4PrintView.tsx` *(baru)*
- `src/app/(dashboard)/notes/[id]/print/page.tsx` *(baru)*
- `src/app/globals.css` *(modifikasi: aturan `@media print` halaman A4 2 kolom)*

### Tugas
- [ ] Buat `src/actions/quiz.ts` (`submitQuizAttemptAction`): validasi Zod (`skillId`, `sourceType: 'note_cloze' | 'module_drill'`, `totalQuestions`, `correctAnswers`), hitung skor persentase, simpan baris `quiz_attempts`, ambil 3 skor kuis terbaru + sinyal Lab/Interview terkait, hitung ulang `MasteryScore` dan `SkillStatus` via `src/lib/mastery.ts`, perbarui baris `skills`, dan `revalidatePath`.
- [ ] Bangun `src/components/quiz/ClozeQuizRunner.tsx` dan `/quiz/page.tsx`: mendukung pilihan catatan (atau filter `Skill`), mode input isian dengan petunjuk opsional (`::petunjuk`), koreksi per soal menggunakan `evaluateClozeAnswer`, ringkasan skor akhir, serta daftar riwayat `QuizAttempt`.
- [ ] Tambahkan aturan `@media print` A4 (margin rapi, `columns: 2`, `break-inside: avoid` pada blok kode & kartu, sembunyikan elemen non-cetak) di `src/app/globals.css`.
- [ ] Bangun `src/components/notes/A4PrintView.tsx` dan `/notes/[id]/print/page.tsx` (tanpa sidebar/navbar dashboard, tombol **Cetak / Simpan PDF** via `window.print()`, dan opsi tampilkan/sembunyikan jawaban cloze).

### Verification Checklist
- [ ] `npx tsc --noEmit`, `npm run lint`, dan `npm test` lulus.
- [ ] `npm run build` lulus.
- [ ] Verifikasi lokal: kerjakan 1 sesi kuis dari catatan di `/quiz`, pastikan `quiz_attempts` tersimpan dan `mastery_score` skill terkait naik (maks. *cap* 65 jika baru sinyal Quiz); buka `/notes/[id]/print` dan cek *print preview* 2 kolom A4.

### Saran Conventional Commit
```text
feat(quiz): add cloze quiz runner, mastery score update, and A4 print view
```

---

## Handoff Log

*(Kosong — akan diisi setelah setiap sub-step dikonfirmasi lulus verifikasi)*
