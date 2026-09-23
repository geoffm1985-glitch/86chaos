import React, { createContext, useContext, useMemo } from 'react';
import i18nCore from './i18n.cjs';

const core = i18nCore?.default && typeof i18nCore.default === 'object' ? i18nCore.default : i18nCore;
export const {
  SUPPORTED_APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  normalizeAppLanguage,
  translate,
  localeForLanguage,
  formatLocalizedDate,
  formatLocalizedFullDate,
  formatLocalizedMonth,
  getMissingTranslationKeys,
} = core;

const I18nContext = createContext({
  language: DEFAULT_APP_LANGUAGE,
  locale: 'en-US',
  t: (key, values, fallback) => translate(DEFAULT_APP_LANGUAGE, key, values, fallback),
  formatDate: (value, options) => formatLocalizedDate(value, DEFAULT_APP_LANGUAGE, options),
  formatFullDate: value => formatLocalizedFullDate(value, DEFAULT_APP_LANGUAGE),
  formatMonth: value => formatLocalizedMonth(value, DEFAULT_APP_LANGUAGE),
});

export const I18nProvider = ({ language = DEFAULT_APP_LANGUAGE, children }) => {
  const normalized = normalizeAppLanguage(language);
  const value = useMemo(() => ({
    language: normalized,
    locale: localeForLanguage(normalized),
    t: (key, values, fallback) => translate(normalized, key, values, fallback),
    formatDate: (date, options) => formatLocalizedDate(date, normalized, options),
    formatFullDate: date => formatLocalizedFullDate(date, normalized),
    formatMonth: month => formatLocalizedMonth(month, normalized),
  }), [normalized]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
