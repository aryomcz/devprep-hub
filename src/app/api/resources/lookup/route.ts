import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { lookupTechnicalTerm } from "@/services/external/lookup";

export const maxDuration = 30;

const querySchema = z
  .string()
  .trim()
  .min(1, "Parameter q wajib diisi.")
  .max(120, "Parameter q maksimal 120 karakter.");

export async function GET(request: NextRequest) {
  try {
    await requireAllowedUser();

    const parsed = querySchema.safeParse(
      request.nextUrl.searchParams.get("q") ?? "",
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Query tidak valid." },
        { status: 400 },
      );
    }

    const results = await lookupTechnicalTerm(parsed.data);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Gagal melakukan Quick Lookup." },
      { status: 500 },
    );
  }
}
