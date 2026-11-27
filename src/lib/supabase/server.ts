import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import type { Database } from "@/types/database";

const withCache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  typeof cache === "function" ? cache : (fn) => fn;

export async function createClient() {
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Safe to ignore when called from a Server Component render; proxy refreshes cookies.
          }
        },
      },
    },
  );
}

/** Request-memoized auth lookup to avoid duplicate getUser() calls across layout and pages. */
export const getAuthenticatedUser = withCache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Server-only admin client for /api/cron/* using SUPABASE_SECRET_KEY. */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
