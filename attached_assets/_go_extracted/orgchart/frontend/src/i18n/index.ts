import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import ar from "./ar";

// Shared with the unified EMS top bar (backend/emsbar.go), which is the single
// language control. The bar writes this localStorage key and reloads, so we read
// it on init to render in the chosen language with correct RTL/LTR.
const savedLang = localStorage.getItem("applxai_lang") || "ar";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
