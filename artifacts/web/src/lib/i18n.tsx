import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { ar } from "./translations/ar";
import { en } from "./translations/en";

export type Lang = "ar" | "en";
export type Translations = Record<string, any>;

const dictionaries: Record<Lang, Translations> = { ar, en };

interface I18nCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "ar",
  dir: "rtl",
  setLang: () => {},
  t: (k) => k,
});

function resolve(obj: any, path: string): string | undefined {
  return path.split(".").reduce((o, k) => o?.[k], obj) as string | undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang");
    return saved === "en" ? "en" : "ar";
  });

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("lang", lang);
    html.setAttribute("dir", dir);
    localStorage.setItem("lang", lang);
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let val = resolve(dictionaries[lang], key) ?? resolve(dictionaries.ar, key) ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          val = val.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return val;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
