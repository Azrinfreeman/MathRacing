import { describe, expect, it } from 'vitest';
import { en } from '../locales/en';
import { ALL_MESSAGE_KEYS, createTranslator, translate } from '../locales';
import type { MessageKey } from '../locales';

describe('locales', () => {
  it('has a Bahasa Melayu string for every key (BM is complete for the core flow)', () => {
    for (const key of ALL_MESSAGE_KEYS) expect(translate('bm', key).length, key).toBeGreaterThan(0);
  });

  it('has no English keys that do not exist in BM (typo guard)', () => {
    for (const key of Object.keys(en)) expect(ALL_MESSAGE_KEYS, key).toContain(key as MessageKey);
  });

  it('translates every core-flow key to English', () => {
    const untranslated = ALL_MESSAGE_KEYS.filter((k) => en[k] === undefined);
    // Only the language-toggle labels are intentionally left to fall back (each names its own language).
    expect(untranslated.sort()).toEqual(['setup.language.bm', 'setup.language.en']);
  });

  it('falls back to Bahasa Melayu (never a raw key) when an English string is missing', () => {
    expect(translate('en', 'setup.language.bm')).toBe('Bahasa Melayu');
    expect(translate('en', 'setup.language.bm')).not.toContain('setup.');
  });

  it('interpolates parameters and leaves unknown placeholders intact', () => {
    expect(translate('bm', 'race.winner', { name: 'Aina' })).toBe('Aina MENANG!');
    expect(translate('en', 'results.progress', { n: 3, total: 8 })).toBe('3 of 8 steps');
    expect(translate('bm', 'results.place')).toBe('Tempat {n}');
  });

  it('createTranslator binds the language', () => {
    expect(createTranslator('en')('setup.start')).toBe('Start');
    expect(createTranslator('bm')('setup.start')).toBe('Mula');
  });

  it('keeps placeholders consistent between languages', () => {
    const placeholders = (s: string): string[] =>
      [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
    for (const key of ALL_MESSAGE_KEYS) {
      const english = en[key];
      if (english === undefined) continue;
      expect(placeholders(english), key).toEqual(placeholders(translate('bm', key)));
    }
  });

  it('states the PBD boundary in both languages', () => {
    expect(translate('bm', 'setup.pbdNotice')).toMatch(/tidak menetapkan Tahap Penguasaan/);
    expect(translate('en', 'setup.pbdNotice')).toMatch(/does not assign a Tahap Penguasaan/);
    expect(translate('bm', 'results.evidence.note')).toMatch(/bukan markah/);
    expect(translate('en', 'results.evidence.note')).toMatch(/not a mark/);
  });
});
