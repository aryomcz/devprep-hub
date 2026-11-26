"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

export type DigestActionResult = { ok: true } | { ok: false; error: string };

export async function markDigestReadAction(
  digestId: string,
  isRead = true,
): Promise<DigestActionResult> {
  try {
    const user = await requireAllowedUser();
    const id = z.uuid("ID digest tidak valid.").parse(digestId);
    const supabase = await createClient();

    const { error } = await supabase
      .from("daily_digests")
      .update({ is_read: isRead })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: "Gagal memperbarui status baca digest." };
    }

    revalidatePath("/digest");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return { ok: false, error: "Akses ditolak." };
    }
    return { ok: false, error: "Input digest tidak valid." };
  }
}
