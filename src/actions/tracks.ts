"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
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

function getErrorMessage(error: unknown): string {
  if (error instanceof AuthGuardError) {
    return error.status === 401
      ? "Sesi berakhir. Silakan login kembali."
      : "Akses ditolak oleh Single-User Gate.";
  }
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Input Learning Track tidak valid.";
  }
  return "Terjadi kesalahan saat memproses Learning Track.";
}

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
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function deleteTrackAction(
  id: string,
): Promise<TrackActionResult<undefined>> {
  try {
    const user = await requireAllowedUser();
    const trackId = z.uuid("ID track tidak valid.").parse(id);
    const supabase = await createClient();

    const { error } = await supabase
      .from("learning_tracks")
      .delete()
      .eq("id", trackId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/tracks");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
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
    const user = await requireAllowedUser();
    const parsed = unlockNextModuleSchema.parse(input);
    const supabase = await createClient();

    const { data: track, error: trackError } = await supabase
      .from("learning_tracks")
      .select("id")
      .eq("id", parsed.trackId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (trackError) {
      return { ok: false, error: trackError.message };
    }
    if (!track) {
      return { ok: false, error: "Learning Track tidak ditemukan." };
    }

    const { data: modules, error: modulesError } = await supabase
      .from("track_modules")
      .select("id, order_index, status")
      .eq("track_id", parsed.trackId)
      .order("order_index", { ascending: true });

    if (modulesError) {
      return { ok: false, error: modulesError.message };
    }

    const list = modules ?? [];
    const currentIndex = list.findIndex((m) => m.id === parsed.moduleId);
    if (currentIndex === -1) {
      return { ok: false, error: "Modul tidak ditemukan pada track ini." };
    }

    const { error: completeError } = await supabase
      .from("track_modules")
      .update({ status: "completed" })
      .eq("id", parsed.moduleId)
      .eq("track_id", parsed.trackId);

    if (completeError) {
      return { ok: false, error: completeError.message };
    }

    const nextLocked = list.find(
      (mod, idx) => idx > currentIndex && mod.status === "locked",
    );

    if (nextLocked) {
      const { error: unlockError } = await supabase
        .from("track_modules")
        .update({ status: "in_progress" })
        .eq("id", nextLocked.id)
        .eq("track_id", parsed.trackId);

      if (unlockError) {
        return { ok: false, error: unlockError.message };
      }
    }

    const allCompleted = list.every(
      (mod) => mod.id === parsed.moduleId || mod.status === "completed",
    );

    if (allCompleted) {
      await supabase
        .from("learning_tracks")
        .update({ status: "completed" })
        .eq("id", parsed.trackId)
        .eq("user_id", user.id);
    }

    revalidatePath("/tracks");
    revalidatePath(`/tracks/${parsed.trackId}`);
    revalidatePath("/dashboard");

    return {
      ok: true,
      data: {
        unlockedModuleId: nextLocked?.id ?? null,
        trackCompleted: allCompleted,
      },
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
