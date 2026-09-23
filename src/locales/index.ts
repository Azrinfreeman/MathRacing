import type { Language } from '../curriculum/schema';
import type { MessageKey } from './bm';
import { bm } from './bm';
import { en } from './en';

export type { MessageKey } from './bm';
export type Params = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: Params) => string;

const catalogs: Record<Language, Partial<Record<MessageKey, string>>> = { bm, en };

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * Translate a key. A string missing in the chosen language falls back to Bahasa Melayu; only if it is
 * missing everywhere (a programming error caught by tests) does it return an empty string, never the key.
 */
export function translate(language: Language, key: MessageKey, params?: Params): string {
  const raw = catalogs[language][key] ?? bm[key];
  return typeof raw === 'string' ? interpolate(raw, params) : '';
}

export function createTranslator(language: Language): Translator {
  return (key, params) => translate(language, key, params);
}

export const ALL_MESSAGE_KEYS = Object.keys(bm) as MessageKey[];
