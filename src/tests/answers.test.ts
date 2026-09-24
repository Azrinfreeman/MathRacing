import { describe, expect, it } from 'vitest';
import { evaluateAnswer, normalizeDecimal, senToRmText } from '../curriculum/answers';
import type { GeneratedQuestion } from '../curriculum/schema';

function base(overrides: Partial<GeneratedQuestion>): GeneratedQuestion {
  return {
    id: 'q1',
    packId: 'p',
    packVersion: '1.0.0',
    year: 1,
    topicId: 't',
    standardKandungan: ['1.1-1.5'],
    standardPembelajaran: [],
    templateId: 'tpl',
    difficultyBand: 'b',
    level: 1,
    language: 'bm',
    prompt: { text: 'x' },
    widget: 'number-pad',
    acceptedAnswer: { kind: 'number', value: '50' },
    metadata: {},
    ...overrides,
  };
}

describe('normalizeDecimal', () => {
  it('strips leading and trailing zeros exactly', () => {
    expect(normalizeDecimal('007')).toBe('7');
    expect(normalizeDecimal('0.70')).toBe('0.7');
    expect(normalizeDecimal('00.1')).toBe('0.1');
    expect(normalizeDecimal('12.500')).toBe('12.5');
    expect(normalizeDecimal('0')).toBe('0');
    expect(normalizeDecimal('0.0')).toBe('0');
    expect(normalizeDecimal(' 45 ')).toBe('45');
  });

  it('rejects text that is not a plain non-negative decimal', () => {
    for (const bad of ['', ' ', '-5', '1e3', 'abc', '1.', '.5', '1,5', '1.2.3', '+3']) {
      expect(normalizeDecimal(bad)).toBeNull();
    }
  });

  it('does not lose precision on values floats cannot hold', () => {
    expect(normalizeDecimal('0.1')).toBe('0.1');
    expect(normalizeDecimal('0.30000000000000004')).toBe('0.30000000000000004');
    expect(normalizeDecimal('123456789012345678901234567890')).toBe(
      '123456789012345678901234567890',
    );
  });
});

describe('senToRmText', () => {
  it('formats integer sen as exact ringgit text', () => {
    expect(senToRmText(0)).toBe('0.00');
    expect(senToRmText(5)).toBe('0.05');
    expect(senToRmText(250)).toBe('2.50');
    expect(senToRmText(700)).toBe('7.00');
    expect(senToRmText(10000)).toBe('100.00');
  });
  it('rejects fractional or negative sen', () => {
    expect(() => senToRmText(1.5)).toThrow(RangeError);
    expect(() => senToRmText(-5)).toThrow(RangeError);
  });
});

describe('evaluateAnswer', () => {
  it('accepts a number answer regardless of leading zeros and treats empty input as not valid', () => {
    const q = base({});
    expect(evaluateAnswer(q, { kind: 'number', raw: '50' })).toMatchObject({
      valid: true,
      correct: true,
      normalized: '50',
    });
    expect(evaluateAnswer(q, { kind: 'number', raw: '050' }).correct).toBe(true);
    expect(evaluateAnswer(q, { kind: 'number', raw: '51' })).toMatchObject({
      valid: true,
      correct: false,
    });
    expect(evaluateAnswer(q, { kind: 'number', raw: '' })).toMatchObject({
      valid: false,
      correct: false,
    });
  });

  it('compares exact decimal strings, not floats', () => {
    const q = base({ acceptedAnswer: { kind: 'number', value: '0.3' } });
    expect(evaluateAnswer(q, { kind: 'number', raw: '0.30' }).correct).toBe(true);
    expect(evaluateAnswer(q, { kind: 'number', raw: '0.30000000000000004' }).correct).toBe(false);
  });
});
