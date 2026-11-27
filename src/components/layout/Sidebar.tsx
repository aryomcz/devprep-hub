"use client";

import {
  BookOpen,
  Briefcase,
  CheckCircle2,
  Compass,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/internships", label: "Target Magang", icon: Briefcase },
  { href: "/tracks", label: "Learning Tracks", icon: Compass },
  { href: "/digest", label: "Daily Digest", icon: Newspaper },
  { href: "/notes", label: "Catatan & Cheat-Sheet", icon: BookOpen },
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
    <nav className="flex flex-col gap-0.5" aria-label="Main navigation">
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
              "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-2xs ring-1 ring-sidebar-border dark:shadow-none"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-foreground"
              />
            ) : null}
            <Icon
              className={cn(
                "size-4 shrink-0 transition-transform duration-150",
                active
                  ? "text-foreground"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-foreground" />
          <span className="text-sm font-semibold tracking-[-0.02em]">
            DevPrep Hub
          </span>
        </div>
        <span className="rounded border border-sidebar-border bg-background/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          v1.0
        </span>
      </div>
      <Separator className="bg-sidebar-border" />
      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <SidebarNavLinks />
      </div>
    </aside>
  );
}
