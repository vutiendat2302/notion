"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { DICTIONARIES, type Locale, type TranslationDict } from "@/i18n/dictionaries";

interface I18nContextValue {
  locale: Locale;
  t: TranslationDict;
  setLocale: (next: Locale) => void;
  translateStatus: (status: string) => string;
  translatePriority: (priority: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "vi",
  t: DICTIONARIES.vi,
  setLocale: () => {},
  translateStatus: (s) => s,
  translatePriority: (p) => p,
});

const STORAGE_KEY = "notion_locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "vi") return saved;
    }
    return "vi";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const t = DICTIONARIES[locale] as TranslationDict;

  const translateStatus = useCallback(
    (status: string) => {
      const map = t.status as Record<string, string>;
      return map[status] ?? status;
    },
    [t]
  );

  const translatePriority = useCallback(
    (priority: string) => {
      const map = t.priority as Record<string, string>;
      return map[priority] ?? priority;
    },
    [t]
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLocale, translateStatus, translatePriority }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
