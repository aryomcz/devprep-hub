"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatActionError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export type NoteActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const createNoteSchema = z.object({
  title: z.string().trim().min(1, "Judul catatan wajib diisi.").max(200),
  contentMd: z.string().max(100_000).optional().default(""),
  skillId: z.uuid("ID skill tidak valid.").nullable().optional(),
});

const updateNoteSchema = z.object({
  id: z.uuid("ID catatan tidak valid."),
  title: z.string().trim().min(1, "Judul catatan wajib diisi.").max(200),
  contentMd: z.string().max(100_000),
  skillId: z.uuid("ID skill tidak valid.").nullable().optional(),
});

const saveToNoteSchema = z.object({
  title: z.string().trim().min(1, "Judul catatan wajib diisi.").max(200),
  term: z.string().trim().min(1, "Istilah wajib diisi.").max(200),
  definition: z.string().trim().min(1, "Definisi wajib diisi.").max(10_000),
  sourceLabel: z.string().trim().min(1).max(300),
  skillId: z.uuid("ID skill tidak valid.").nullable().optional(),
});

function getErrorMessage(error: unknown): string {
  return formatActionError(
    error,
    "Input catatan tidak valid.",
    "Terjadi kesalahan saat memproses catatan.",
  );
}

async function verifyOwnedSkillId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  skillId: string | null | undefined,
): Promise<string | null> {
  if (!skillId) return null;
  const { data, error } = await supabase
    .from("skills")
    .select("id")
    .eq("id", skillId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Skill terkait tidak ditemukan atau bukan milik Anda.");
  }
  return data.id;
}

export async function createNoteAction(
  input: z.input<typeof createNoteSchema>,
): Promise<NoteActionResult<{ noteId: string }>> {
  try {
    const user = await requireAllowedUser();
    const parsed = createNoteSchema.parse(input);
    const supabase = await createClient();
    const ownedSkillId = await verifyOwnedSkillId(
      supabase,
      user.id,
      parsed.skillId,
    );

    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        title: parsed.title,
        content_md: parsed.contentMd,
        skill_id: ownedSkillId,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Gagal membuat catatan baru.",
      };
    }

    revalidatePath("/notes");
    revalidatePath("/quiz");
    return { ok: true, data: { noteId: data.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateNoteAction(
  input: z.input<typeof updateNoteSchema>,
): Promise<NoteActionResult<{ noteId: string }>> {
  try {
    const user = await requireAllowedUser();
    const parsed = updateNoteSchema.parse(input);
    const supabase = await createClient();
    const ownedSkillId = await verifyOwnedSkillId(
      supabase,
      user.id,
      parsed.skillId,
    );

    const { error } = await supabase
      .from("notes")
      .update({
        title: parsed.title,
        content_md: parsed.contentMd,
        skill_id: ownedSkillId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.id)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/notes");
    revalidatePath(`/notes/${parsed.id}`);
    revalidatePath(`/notes/${parsed.id}/print`);
    revalidatePath("/quiz");
    return { ok: true, data: { noteId: parsed.id } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteNoteAction(
  id: string,
): Promise<NoteActionResult<undefined>> {
  try {
    const user = await requireAllowedUser();
    const noteId = z.uuid("ID catatan tidak valid.").parse(id);
    const supabase = await createClient();

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/notes");
    revalidatePath("/quiz");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function saveToNoteAction(
  input: z.input<typeof saveToNoteSchema>,
): Promise<NoteActionResult<{ noteId: string }>> {
  try {
    const user = await requireAllowedUser();
    const parsed = saveToNoteSchema.parse(input);
    const supabase = await createClient();
    const ownedSkillId = await verifyOwnedSkillId(
      supabase,
      user.id,
      parsed.skillId,
    );

    const section = [
      `### {{${parsed.term}}}`,
      "",
      parsed.definition,
      "",
      `> Sumber: ${parsed.sourceLabel}`,
    ].join("\n");

    const { data: existing } = await supabase
      .from("notes")
      .select("id, content_md, skill_id")
      .eq("user_id", user.id)
      .eq("title", parsed.title)
      .limit(1)
      .maybeSingle();

    let noteId: string;

    if (existing) {
      const nextContent = existing.content_md.trim()
        ? `${existing.content_md.trimEnd()}\n\n${section}`
        : section;

      const { error } = await supabase
        .from("notes")
        .update({
          content_md: nextContent,
          skill_id: existing.skill_id ?? ownedSkillId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (error) {
        return { ok: false, error: error.message };
      }
      noteId = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          title: parsed.title,
          content_md: section,
          skill_id: ownedSkillId,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !inserted) {
        return {
          ok: false,
          error: error?.message ?? "Gagal menyimpan ke catatan.",
        };
      }
      noteId = inserted.id;
    }

    revalidatePath("/notes");
    revalidatePath(`/notes/${noteId}`);
    revalidatePath("/quiz");
    return { ok: true, data: { noteId } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
