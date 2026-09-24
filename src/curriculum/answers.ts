import type { AcceptedAnswer, GeneratedQuestion, SubmittedAnswer } from './schema';

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

/**
 * The one and only place where submitted answers are checked against a question.
 * All widgets route through this service; none of them validate on their own.
 */
export function evaluateAnswer(
  question: GeneratedQuestion,
  submitted: SubmittedAnswer,
): AnswerEvaluation {
  const accepted: AcceptedAnswer = question.acceptedAnswer;
  const normalized = normalizeDecimal(submitted.raw);
  if (normalized === null) return { valid: false, correct: false, normalized: '' };
  return { valid: true, correct: normalized === normalizeDecimal(accepted.value), normalized };
}

/** Human-readable text of the correct answer (used by fixtures, previews and teacher tools). */
export function answerText(question: Pick<GeneratedQuestion, 'acceptedAnswer'>): string {
  return question.acceptedAnswer.value;
}
