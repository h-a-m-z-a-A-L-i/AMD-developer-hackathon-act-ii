"use client";

import { useEffect, useRef, useState } from "react";
import type { PatientDropdownItem } from "@/types";

interface RecordSelectProps {
  patients: PatientDropdownItem[];
  value: string;
  onChange: (patientId: string) => void;
  disabled?: boolean;
}

/**
 * Replaces the native <select> for the patient record picker. Native
 * <select> dropdown *panels* are rendered by the OS/browser chrome, not
 * by our CSS — so no amount of Tailwind on the <select> itself can fix
 * how the option list looks in dark mode. This is a fully custom,
 * theme-aware listbox instead.
 */
export function RecordSelect({ patients, value, onChange, disabled }: RecordSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selected = patients.find((p) => p.patient_id === value);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 rounded-full bg-transparent px-1 text-sm font-mono font-semibold text-slate-900 focus:outline-none disabled:opacity-40 dark:text-slate-100"
      >
        <span className="truncate">
          {selected
            ? `${selected.patient_id} (Age: ${selected.age}, A1c: ${selected.a1c_percent}%)`
            : "Select a patient"}
        </span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-40 mt-2 max-h-72 w-max min-w-[260px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {patients.map((p) => {
            const isSelected = p.patient_id === value;
            return (
              <li
                key={p.patient_id}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(p.patient_id);
                  setIsOpen(false);
                }}
                className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-2 text-sm font-mono transition-colors ${
                  isSelected
                    ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {p.patient_id} (Age: {p.age}, A1c: {p.a1c_percent}%)
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
