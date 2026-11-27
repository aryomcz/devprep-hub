import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthGuardError, requireAllowedUser } from "@/lib/auth-guard";

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

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:border focus:border-ring focus:bg-background focus:px-3 focus:py-2 focus:text-xs focus:font-medium focus:text-foreground focus:shadow-md"
      >
        Lewati ke konten utama
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav userEmail={user.email} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-5 outline-none md:px-7 md:py-7 lg:px-9 lg:py-8"
        >
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
