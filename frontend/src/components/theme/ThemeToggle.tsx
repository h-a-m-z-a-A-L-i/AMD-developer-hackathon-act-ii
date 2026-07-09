"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "glycoswarm-theme";

function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Start as null (unknown) so the button doesn't briefly flash the wrong
  // icon before the inline layout script has told us which theme is active.
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch {
        // ignore (e.g. privacy mode)
      }
      return next;
    });
  };

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
      className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${className}`}
    >
      {/* Sun icon */}
      <svg
        className={`absolute h-5 w-5 transition-all duration-200 ${isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364 6.364l-1.06-1.06M6.696 6.696L5.636 5.636m12.728 0l-1.06 1.06M6.696 17.304l-1.06 1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
      {/* Moon icon */}
      <svg
        className={`absolute h-5 w-5 transition-all duration-200 ${isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    </button>
  );
}
