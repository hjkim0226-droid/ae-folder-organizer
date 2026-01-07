/**
 * useI18n Hook
 * Provides internationalization support with Korean/English
 */

import { useMemo } from "react";
import { useConfig } from "../contexts";
import { translations, detectLanguage, interpolate, type Language, type Translations } from "../../domain/i18n";

interface UseI18nReturn {
  t: Translations;
  lang: Language;
  setLanguage: (lang: Language | "auto") => void;
  interpolate: (text: string, params: Record<string, string | number>) => string;
}

export function useI18n(): UseI18nReturn {
  const { config, updateSettings } = useConfig();

  // Determine current language
  const lang = useMemo((): Language => {
    const setting = config.settings.language;
    if (setting === "auto" || !setting) {
      return detectLanguage();
    }
    return setting as Language;
  }, [config.settings.language]);

  // Get translations for current language
  const t = useMemo(() => translations[lang], [lang]);

  // Set language
  const setLanguage = (newLang: Language | "auto") => {
    updateSettings({ language: newLang });
  };

  return {
    t,
    lang,
    setLanguage,
    interpolate,
  };
}
