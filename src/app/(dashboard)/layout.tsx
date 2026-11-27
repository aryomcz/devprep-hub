import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedShell({ children }: { children: ReactNode }) {
  let user: { id: string; email: string };

  try {
    user = await requireAllowedUser();
  } catch (error) {
    if (error instanceof AuthGuardError && error.status === 403) {
      redirect("/login?error=forbidden");
    }
    redirect("/login");
  }

  // Ensure pre-existing auth.users rows created prior to trigger migration have a profiles row.
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav userEmail={user.email} />
        <main className="flex-1 px-4 py-5 md:px-7 md:py-7 lg:px-9 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Memeriksa sesi...
        </div>
      }
    >
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
