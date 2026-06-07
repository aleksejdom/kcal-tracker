"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { translations, type Lang } from "@/lib/translations";

type T = typeof translations[Lang];

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: T; }

const LanguageContext = createContext<LangCtx>({
  lang: "de",
  setLang: () => {},
  t: translations.de as T,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    const stored = localStorage.getItem("lang") as Lang | null;
    if (stored === "de" || stored === "ru") setLangState(stored);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("lang", l);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] as T }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
