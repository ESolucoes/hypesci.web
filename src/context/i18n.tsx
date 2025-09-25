import { createContext, useContext, useMemo, useState } from "react";

type Lang = "en" | "pt" | "es" | "fr" | "de" | "it" | "ru" | "zh";
type Ctx = { lang: Lang; setLang: (l: Lang) => void };

const I18nContext = createContext<Ctx | null>(null);

const STORAGE_KEY = (import.meta.env?.VITE_I18N_STORAGE_KEY as string);
const DEFAULT_LANG = (import.meta.env?.VITE_I18N_DEFAULT_LANG as string) as Lang;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Lang) || DEFAULT_LANG;
    return saved;
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };
  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
