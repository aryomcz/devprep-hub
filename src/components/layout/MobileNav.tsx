"use client";

import { CheckCircle2, LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SidebarNavLinks } from "@/components/layout/Sidebar";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-primary" />
        <span className="font-semibold tracking-tight">DevPrep Hub</span>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" size="icon-sm" aria-label="Open menu" />
          }
        >
          <Menu className="size-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              <span>DevPrep Hub</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            <SidebarNavLinks onNavigate={() => setOpen(false)} />
          </div>
          <Separator />
          <div className="flex flex-col gap-2 p-3">
            <p className="truncate px-1 text-xs text-muted-foreground">
              {userEmail}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="justify-start gap-2"
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
