import { timingSafeEqual } from "node:crypto";

export type GuardUser = {
  id: string;
  email?: string | null;
};

export class AuthGuardError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AuthGuardError";
    this.status = status;
  }
}

export function isAllowedEmail(
  email: string | null | undefined,
  allowedEmail: string | null | undefined = process.env.ALLOWED_USER_EMAIL,
): boolean {
  const expected = allowedEmail?.trim().toLowerCase();
  const actual = email?.trim().toLowerCase();
  if (!expected || !actual) return false;
  return actual === expected;
}

export function verifyCronSecret(
  authHeader: string | null | undefined,
  cronSecret: string | null | undefined = process.env.CRON_SECRET,
): boolean {
  if (!cronSecret || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const provided = Buffer.from(authHeader.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(cronSecret, "utf8");
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export async function requireAllowedUser(
  getUserFn?: () => Promise<GuardUser | null>,
  allowedEmail: string | null | undefined = process.env.ALLOWED_USER_EMAIL,
): Promise<{ id: string; email: string }> {
  let user: GuardUser | null;

  if (getUserFn) {
    user = await getUserFn();
  } else {
    const { getAuthenticatedUser } = await import("@/lib/supabase/server");
    user = await getAuthenticatedUser();
  }

  if (!user) {
    throw new AuthGuardError("Unauthorized", 401);
  }
  if (!isAllowedEmail(user.email, allowedEmail)) {
    throw new AuthGuardError("Forbidden", 403);
  }

  return { id: user.id, email: user.email! };
}

export function formatActionError(
  error: unknown,
  invalidFallback: string,
  genericFallback: string,
): string {
  if (error instanceof AuthGuardError) {
    return error.status === 401
      ? "Sesi berakhir. Silakan login kembali."
      : "Akses ditolak oleh Single-User Gate.";
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  ) {
    const firstIssue = (error as { issues: Array<{ message?: string }> })
      .issues[0];
    return firstIssue?.message ?? invalidFallback;
  }
  return genericFallback;
}
