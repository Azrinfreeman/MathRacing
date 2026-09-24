import type { GeneratedQuestion, SubmittedAnswer } from '../curriculum/schema';

/** The submission a perfect pupil would make: the answer typed on the number pad. */
export function correctSubmission(q: GeneratedQuestion): SubmittedAnswer {
  return { kind: 'number', raw: q.acceptedAnswer.value };
}
