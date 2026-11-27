"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "devprep-theme";

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=t==="dark"||(t!=="light"&&m);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const listeners = new Set<() => void>();

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") {
      return raw;
    }
  } catch {
    // Ignore storage read errors in restricted contexts.
  }
  return "system";
}

function resolvePreference(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeToDocument(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const resolved = resolvePreference(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function subscribeTheme(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (typeof window === "undefined") {
    return () => {
      listeners.delete(onStoreChange);
    };
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = () => {
    if (readStoredPreference() === "system") {
      applyThemeToDocument("system");
      onStoreChange();
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyThemeToDocument(readStoredPreference());
      onStoreChange();
    }
  };

  mediaQuery.addEventListener("change", handleMediaChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(onStoreChange);
    mediaQuery.removeEventListener("change", handleMediaChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function getThemeSnapshot(): string {
  const pref = readStoredPreference();
  const resolved = resolvePreference(pref);
  return `${pref}:${resolved}`;
}

function getServerThemeSnapshot(): string {
  return "system:light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const [theme, resolvedTheme] = snapshot.split(":") as [
    ThemePreference,
    ResolvedTheme,
  ];

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors in restricted contexts.
    }
    applyThemeToDocument(next);
    listeners.forEach((listener) => listener());
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
    };
  }
  return ctx;
}

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

export function ThemeToggle({
  variant = "segmented",
  className,
}: {
  variant?: "segmented" | "icon";
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (variant === "icon") {
    const nextTheme: ThemePreference =
      resolvedTheme === "dark" ? "light" : "dark";
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => setTheme(nextTheme)}
        aria-label={
          resolvedTheme === "dark"
            ? "Beralih ke Light Mode"
            : "Beralih ke Dark Mode"
        }
        title={
          resolvedTheme === "dark"
            ? "Beralih ke Light Mode"
            : "Beralih ke Dark Mode"
        }
        className={cn("relative", className)}
      >
        <Sun className="size-3.5 scale-100 rotate-0 transition-transform duration-150 dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-3.5 scale-0 rotate-90 transition-transform duration-150 dark:scale-100 dark:rotate-0" />
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Pilihan tema tampilan"
      className={cn(
        "grid grid-cols-3 gap-0.5 rounded-lg border border-border bg-background/70 p-0.5",
        className,
      )}
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-6 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              active
                ? "bg-card text-foreground shadow-2xs ring-1 ring-border/80 dark:shadow-none"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3 shrink-0" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
