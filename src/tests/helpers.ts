import type { GeneratedQuestion, SubmittedAnswer } from '../curriculum/schema';

/** The submission a perfect pupil would make for any widget kind. */
export function correctSubmission(q: GeneratedQuestion): SubmittedAnswer {
  const a = q.acceptedAnswer;
  switch (a.kind) {
    case 'number':
      return { kind: 'number', raw: a.value };
    case 'choice':
      return q.widget === 'tap-picture'
        ? { kind: 'set', optionIds: [a.optionId] }
        : { kind: 'choice', optionId: a.optionId };
    case 'sequence':
      return { kind: 'sequence', optionIds: a.optionIds };
    case 'set':
      return { kind: 'set', optionIds: a.optionIds };
    case 'count':
      return { kind: 'set', optionIds: (q.options ?? []).slice(0, a.count).map((o) => o.id) };
  }
}
