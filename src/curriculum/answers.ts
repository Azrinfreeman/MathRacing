import type { AcceptedAnswer, GeneratedQuestion, SubmittedAnswer } from './schema';
import { describeVisual } from './visual';

/**
 * Canonical form of a non-negative decimal typed or generated as text.
 *
 * Values are compared as exact decimal *strings* (never as floats), so "0.10", "0.1" and "00.1" all
 * normalise to "0.1", and money kept in whole sen never suffers floating-point drift.
 * Returns null when the text is not a plain non-negative decimal number.
 */
export function normalizeDecimal(raw: string): string | null {
  const s = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [intPartRaw = '', fracRaw = ''] = s.split('.');
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '');
  const frac = fracRaw.replace(/0+$/, '');
  return frac.length > 0 ? `${intPart}.${frac}` : intPart;
}

/** Format an integer number of sen exactly as ringgit text, e.g. 250 -> "2.50", 700 -> "7.00". */
export function senToRmText(sen: number): string {
  if (!Number.isInteger(sen) || sen < 0)
    throw new RangeError(`senToRmText needs a non-negative integer, got ${sen}`);
  const ringgit = Math.floor(sen / 100);
  const cents = sen % 100;
  return `${ringgit}.${cents.toString().padStart(2, '0')}`;
}

export interface AnswerEvaluation {
  /** false when the response is incomplete (e.g. empty keypad); such a submit is not an attempt. */
  valid: boolean;
  correct: boolean;
  /** Canonical text of what was submitted; used for logs and CSV. */
  normalized: string;
}

function sameOrdered(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return new Set(a).size === a.length && a.every((v) => sb.has(v));
}

/**
 * The one and only place where submitted answers are checked against a question.
 * All widgets route through this service; none of them validate on their own.
 */
export function evaluateAnswer(
  question: GeneratedQuestion,
  submitted: SubmittedAnswer,
): AnswerEvaluation {
  const accepted: AcceptedAnswer = question.acceptedAnswer;
  switch (submitted.kind) {
    case 'number': {
      const normalized = normalizeDecimal(submitted.raw);
      if (normalized === null) return { valid: false, correct: false, normalized: '' };
      if (accepted.kind !== 'number') return { valid: true, correct: false, normalized };
      return { valid: true, correct: normalized === normalizeDecimal(accepted.value), normalized };
    }
    case 'choice': {
      if (submitted.optionId === '') return { valid: false, correct: false, normalized: '' };
      const known = question.options?.some((o) => o.id === submitted.optionId) ?? false;
      if (!known) return { valid: false, correct: false, normalized: submitted.optionId };
      const correct = accepted.kind === 'choice' && accepted.optionId === submitted.optionId;
      return { valid: true, correct, normalized: submitted.optionId };
    }
    case 'sequence': {
      const ids = submitted.optionIds;
      const total = question.options?.length ?? 0;
      if (ids.length !== total || new Set(ids).size !== ids.length) {
        return { valid: false, correct: false, normalized: ids.join('>') };
      }
      const correct = accepted.kind === 'sequence' && sameOrdered(ids, accepted.optionIds);
      return { valid: true, correct, normalized: ids.join('>') };
    }
    case 'set': {
      const ids = submitted.optionIds;
      if (ids.length === 0) return { valid: false, correct: false, normalized: '' };
      const normalized = ids.slice().sort().join('+');
      let correct = false;
      if (accepted.kind === 'set') correct = sameSet(ids, accepted.optionIds);
      else if (accepted.kind === 'choice')
        correct = ids.length === 1 && ids[0] === accepted.optionId;
      else if (accepted.kind === 'count')
        correct = new Set(ids).size === ids.length && ids.length === accepted.count;
      return { valid: true, correct, normalized };
    }
  }
}

/** Human-readable text of the correct answer (used by fixtures, previews and teacher tools). */
export function answerText(
  question: Pick<GeneratedQuestion, 'acceptedAnswer' | 'options'>,
): string {
  const a = question.acceptedAnswer;
  const label = (id: string): string => {
    const opt = question.options?.find((o) => o.id === id);
    if (!opt) return id;
    if (opt.label !== undefined) return opt.label;
    return opt.visual ? describeVisual(opt.visual) : id;
  };
  switch (a.kind) {
    case 'number':
      return a.value;
    case 'choice':
      return label(a.optionId);
    case 'sequence':
      return a.optionIds.map(label).join(' > ');
    case 'set':
      return a.optionIds.map(label).join(' + ');
    case 'count':
      return `any ${a.count}`;
  }
}
