"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatActionError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import type { TrackStatus } from "@/types/database";
import { trackStatusSchema } from "@/types/schemas";

export type TrackActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const updateTrackStatusSchema = z.object({
  trackId: z.uuid("ID track tidak valid."),
  status: trackStatusSchema,
});

const unlockNextModuleSchema = z.object({
  trackId: z.uuid("ID track tidak valid."),
  moduleId: z.uuid("ID modul tidak valid."),
});

export async function updateTrackStatusAction(
  input: z.input<typeof updateTrackStatusSchema>,
): Promise<TrackActionResult<{ trackId: string; status: TrackStatus }>> {
  try {
    const user = await requireAllowedUser();
    const parsed = updateTrackStatusSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase
      .from("learning_tracks")
      .update({ status: parsed.status })
      .eq("id", parsed.trackId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/tracks");
    revalidatePath(`/tracks/${parsed.trackId}`);
    revalidatePath("/dashboard");
    return {
      ok: true,
      data: { trackId: parsed.trackId, status: parsed.status },
    };
  } catch (error) {
    return {
      ok: false,
      error: formatActionError(
        error,
        "Input Learning Track tidak valid.",
        "Terjadi kesalahan saat memproses Learning Track.",
      ),
    };
  }
}

export async function unlockNextModuleAction(
  input: z.input<typeof unlockNextModuleSchema>,
): Promise<
  TrackActionResult<{
    unlockedModuleId: string | null;
    trackCompleted: boolean;
  }>
> {
  try {
    await requireAllowedUser();
    const parsed = unlockNextModuleSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "complete_and_unlock_next_module",
      {
        p_track_id: parsed.trackId,
        p_module_id: parsed.moduleId,
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    const result = (data ?? {}) as {
      unlockedModuleId?: string | null;
      trackCompleted?: boolean;
    };

    revalidatePath("/tracks");
    revalidatePath(`/tracks/${parsed.trackId}`);
    revalidatePath("/dashboard");

    return {
      ok: true,
      data: {
        unlockedModuleId: result.unlockedModuleId ?? null,
        trackCompleted: Boolean(result.trackCompleted),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: formatActionError(
        error,
        "Input Learning Track tidak valid.",
        "Terjadi kesalahan saat memproses Learning Track.",
      ),
    };
  }
}
