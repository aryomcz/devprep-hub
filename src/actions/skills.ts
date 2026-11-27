"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatActionError, requireAllowedUser } from "@/lib/auth-guard";
import { deriveSkillStatus } from "@/lib/mastery";
import { normalizeSkill } from "@/lib/skill-normalizer";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { skillCategorySchema } from "@/types/schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

const createSkillInputSchema = z.object({
  name: z.string().trim().min(1, "Nama skill wajib diisi.").max(100),
  category: skillCategorySchema,
  masteryScore: z.number().int().min(0).max(100).optional(),
});

const updateSkillInputSchema = z.object({
  id: z.uuid("ID skill tidak valid."),
  name: z.string().trim().min(1, "Nama skill wajib diisi.").max(100).optional(),
  category: skillCategorySchema.optional(),
  masteryScore: z.number().int().min(0).max(100).optional(),
});

const mergeSkillsInputSchema = z
  .object({
    sourceSkillId: z.uuid("Skill sumber tidak valid."),
    targetSkillId: z.uuid("Skill target tidak valid."),
  })
  .refine((data) => data.sourceSkillId !== data.targetSkillId, {
    message: "Skill sumber dan skill target harus berbeda.",
  });

function getErrorMessage(error: unknown): string {
  return formatActionError(
    error,
    "Input tidak valid.",
    "Terjadi kesalahan saat memproses data skill.",
  );
}

export async function createSkillAction(
  input: z.input<typeof createSkillInputSchema>,
): Promise<ActionResult> {
  try {
    const user = await requireAllowedUser();
    const parsed = createSkillInputSchema.parse(input);
    const normalized = normalizeSkill(parsed.name);

    if (!normalized.slug) {
      return { ok: false, error: "Nama skill tidak valid." };
    }

    const masteryScore = parsed.masteryScore ?? 0;
    const status = deriveSkillStatus(masteryScore);
    const supabase = await createClient();

    const { error } = await supabase.from("skills").insert({
      user_id: user.id,
      name: normalized.canonicalName,
      slug: normalized.slug,
      category: parsed.category,
      mastery_score: masteryScore,
      status,
      source: "manual",
    });

    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: `Skill "${normalized.canonicalName}" (${normalized.slug}) sudah ada.`,
        };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath("/skills");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateSkillAction(
  input: z.input<typeof updateSkillInputSchema>,
): Promise<ActionResult> {
  try {
    const user = await requireAllowedUser();
    const parsed = updateSkillInputSchema.parse(input);
    const patch: Database["public"]["Tables"]["skills"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.name !== undefined) {
      const normalized = normalizeSkill(parsed.name);
      if (!normalized.slug) {
        return { ok: false, error: "Nama skill tidak valid." };
      }
      patch.name = normalized.canonicalName;
      patch.slug = normalized.slug;
    }

    if (parsed.category !== undefined) {
      patch.category = parsed.category;
    }

    if (parsed.masteryScore !== undefined) {
      patch.mastery_score = parsed.masteryScore;
      patch.status = deriveSkillStatus(parsed.masteryScore);
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("skills")
      .update(patch)
      .eq("id", parsed.id)
      .eq("user_id", user.id);

    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: "Nama/slug skill bentrok dengan skill lain. Gunakan Merge Skill.",
        };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath("/skills");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteSkillAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireAllowedUser();
    const skillId = z.uuid("ID skill tidak valid.").parse(id);
    const supabase = await createClient();

    const { error } = await supabase
      .from("skills")
      .delete()
      .eq("id", skillId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/skills");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function mergeSkillsAction(
  input: z.input<typeof mergeSkillsInputSchema>,
): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    const parsed = mergeSkillsInputSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase.rpc("merge_skills", {
      p_source_skill_id: parsed.sourceSkillId,
      p_target_skill_id: parsed.targetSkillId,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/skills");
    revalidatePath("/internships");
    revalidatePath("/notes");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
