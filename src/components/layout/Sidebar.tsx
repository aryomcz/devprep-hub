"use client";

import {
  BookOpen,
  Briefcase,
  CheckCircle2,
  Compass,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Newspaper,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/internships", label: "Internships", icon: Briefcase },
  { href: "/tracks", label: "Learning Tracks", icon: Compass },
  { href: "/digest", label: "Daily Digest", icon: Newspaper },
  { href: "/notes", label: "Smart Notes", icon: BookOpen },
  { href: "/quiz", label: "Cloze Quiz", icon: HelpCircle },
  { href: "/interview", label: "Interview Lab", icon: MessageSquare },
  { href: "/skills", label: "Master Skills", icon: Wrench },
] as const;

export function SidebarNavLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:bg-card">
      <div className="flex h-14 items-center gap-2 px-4">
        <CheckCircle2 className="size-5 text-primary" />
        <span className="font-semibold tracking-tight">DevPrep Hub</span>
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNavLinks />
      </div>
      <Separator />
      <div className="flex flex-col gap-2 p-3">
        <p className="truncate px-1 text-xs text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          disabled={signingOut}
          className="justify-start gap-2"
        >
          <LogOut className="size-4" />
          <span>{signingOut ? "Signing out..." : "Sign out"}</span>
        </Button>
      </div>
    </aside>
  );
}
