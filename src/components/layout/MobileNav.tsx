"use client";

import { CheckCircle2, LogOut, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS, SidebarNavLinks } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";

export function MobileNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeNav = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const userInitial = userEmail.trim().charAt(0).toUpperCase() || "U";

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-md md:px-7 lg:px-9">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon-sm" aria-label="Open menu" />
              }
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetHeader className="border-b border-sidebar-border px-4 py-3">
                <SheetTitle className="flex items-center gap-2 text-sm font-semibold tracking-[-0.02em]">
                  <CheckCircle2 className="size-4 text-foreground" />
                  <span>DevPrep Hub</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-3">
                <SidebarNavLinks onNavigate={() => setOpen(false)} />
              </div>
              <Separator className="bg-sidebar-border" />
              <div className="flex flex-col gap-2.5 p-3">
                <ThemeToggle variant="segmented" />
                <p className="truncate px-1 font-mono text-[11px] text-muted-foreground">
                  {userEmail}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="justify-start gap-2"
                >
                  <LogOut className="size-3.5" />
                  <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <CheckCircle2 className="size-4 shrink-0 text-foreground" />
          <span className="truncate text-sm font-semibold tracking-[-0.02em]">
            DevPrep Hub
          </span>
        </div>

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span className="font-mono text-[11px] text-muted-foreground">/</span>
          <span className="truncate text-[13px] font-medium text-foreground">
            {activeNav?.label ?? "Workspace"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle variant="switch" />

        <div className="hidden items-center gap-2 rounded-full border border-border bg-background/80 py-1 pr-2.5 pl-1 sm:flex">
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground font-mono text-[10px] font-semibold text-background">
            {userInitial}
          </span>
          <span
            className="max-w-44 truncate font-mono text-[11px] text-muted-foreground"
            title={userEmail}
          >
            {userEmail}
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          disabled={signingOut}
          className="h-8 gap-1.5 rounded-full px-3 text-xs"
        >
          <LogOut className="size-3.5" />
          <span>{signingOut ? "Keluar..." : "Sign out"}</span>
        </Button>
      </div>
    </header>
  );
}
