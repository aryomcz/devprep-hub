"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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
  variant?: "segmented" | "icon" | "switch";
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (variant === "switch" || variant === "icon") {
    const isDark = resolvedTheme === "dark";
    const nextTheme: ThemePreference = isDark ? "light" : "dark";
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={() => setTheme(nextTheme)}
        aria-label={isDark ? "Beralih ke Light Mode" : "Beralih ke Dark Mode"}
        title={isDark ? "Beralih ke Light Mode" : "Beralih ke Dark Mode"}
        className={cn(
          "group relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border border-border bg-secondary/90 p-0.5 shadow-inner transition-colors duration-200 ease-[var(--ease-craft)] outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:bg-slate-700/60",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none flex w-full items-center justify-between px-1.5 text-muted-foreground/55 dark:text-slate-300/60"
        >
          <Sun className="size-3.5" />
          <Moon className="size-3.5" />
        </span>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0.5 left-0.5 flex size-6.5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/8 transition-transform duration-200 ease-[var(--ease-craft)] translate-x-0 dark:translate-x-6 dark:bg-slate-100 dark:ring-white/20"
        >
          <Sun className="size-3.5 text-amber-500 transition-opacity duration-150 dark:hidden" />
          <Moon className="hidden size-3.5 text-indigo-600 transition-opacity duration-150 dark:block" />
        </span>
      </button>
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
