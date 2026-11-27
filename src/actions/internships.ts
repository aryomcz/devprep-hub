"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatActionError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import type { InternshipStatus } from "@/types/database";
import { internshipStatusSchema } from "@/types/schemas";

export type InternshipActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const updateInternshipStatusSchema = z.object({
  id: z.uuid("ID lowongan tidak valid."),
  status: internshipStatusSchema,
});

const deleteInternshipSchema = z.uuid("ID lowongan tidak valid.");

function getErrorMessage(error: unknown): string {
  return formatActionError(
    error,
    "Input lowongan tidak valid.",
    "Terjadi kesalahan saat memproses Target Internship.",
  );
}

export async function updateInternshipStatusAction(
  input: z.input<typeof updateInternshipStatusSchema>,
): Promise<InternshipActionResult<{ id: string; status: InternshipStatus }>> {
  try {
    const user = await requireAllowedUser();
    const parsed = updateInternshipStatusSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase
      .from("target_internships")
      .update({ status: parsed.status })
      .eq("id", parsed.id)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/internships");
    revalidatePath(`/internships/${parsed.id}`);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: parsed.id, status: parsed.status } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteInternshipAction(
  id: string,
): Promise<InternshipActionResult<undefined>> {
  try {
    const user = await requireAllowedUser();
    const internshipId = deleteInternshipSchema.parse(id);
    const supabase = await createClient();

    const { error } = await supabase
      .from("target_internships")
      .delete()
      .eq("id", internshipId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/internships");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
