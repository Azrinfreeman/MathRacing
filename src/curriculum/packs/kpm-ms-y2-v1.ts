import type { CurriculumPack, CurriculumTopic } from '../schema';
import { Y2_EASY_TEMPLATES } from '../generators/easyY2';

/** Topic codes and SK ranges copied from section 6 of the KPM game plan (see the Year 1 pack for the SP note). */
const topics: CurriculumTopic[] = [
  {
    id: 'y2-numbers',
    year: 2,
    code: '1.0',
    title: { bm: 'Nombor Bulat hingga 1 000', en: 'Whole Numbers to 1,000' },
    standardKandungan: '1.1-1.5',
    scope:
      'Name, count and write numbers; compare two values; ascending/descending sequences; place and digit value; patterns; reasonable estimation; round to the nearest ten and hundred.',
  },
  {
    id: 'y2-operations',
    year: 2,
    code: '2.0',
    title: { bm: 'Operasi Asas', en: 'Basic Operations' },
    standardKandungan: '2.1-2.4',
    scope:
      'Add up to three numbers and subtract up to three numbers within 1,000; multiplication facts and one-digit x 10; division facts including remainders and two-digit / 10.',
  },
  {
    id: 'y2-fractions',
    year: 2,
    code: '3.0',
    title: { bm: 'Pecahan dan Perpuluhan', en: 'Fractions and Decimals' },
    standardKandungan: '3.1-3.3',
    scope:
      'Halves and quarters; proper fractions with numerator 1-9 and denominator up to 10; compare fractions; tenths as decimals 0.1-0.9; represent and compare decimals.',
  },
  {
    id: 'y2-money',
    year: 2,
    code: '4.0',
    title: { bm: 'Wang', en: 'Money' },
    standardKandungan: '4.1-4.5',
    scope:
      'Recognise and determine Malaysian money to RM100; add and subtract up to three money values; multiply and divide money within RM100.',
  },
  {
    id: 'y2-time',
    year: 2,
    code: '5.0',
    title: { bm: 'Masa', en: 'Time' },
    standardKandungan: '5.1-5.2',
    scope:
      'Read, write and record hours and minutes; relate 1 hour to 60 minutes and 1 day to 24 hours.',
  },
  {
    id: 'y2-measurement',
    year: 2,
    code: '6.0',
    title: { bm: 'Sukatan', en: 'Measurement' },
    standardKandungan: '6.1-6.3',
    scope:
      'Recognise, measure and estimate length in cm/m, mass in g/kg and liquid volume in ml/l using suitable instruments.',
  },
  {
    id: 'y2-space',
    year: 2,
    code: '7.0',
    title: { bm: 'Ruang', en: 'Space' },
    standardKandungan: '7.1-7.2',
    scope:
      'Identify 3D shapes from properties and nets; identify and draw 2D shapes from properties.',
  },
  {
    id: 'y2-data',
    year: 2,
    code: '8.0',
    title: { bm: 'Pengurusan Data', en: 'Data Management' },
    standardKandungan: '8.1-8.2',
    scope:
      'Collect, classify and arrange everyday data; read bar charts and answer contextual questions.',
  },
];

export const KPM_MS_Y2_V1: CurriculumPack = {
  packId: 'kpm-ms-y2',
  version: '2.0.1',
  year: 2,
  title: {
    bm: 'KSSR (Semakan 2017) - Edisi 3 - Matematik Tahun 2',
    en: 'KSSR (Revised 2017) - Edition 3 - Mathematics Year 2',
  },
  basis: 'KSSR (Semakan 2017), Dokumen Penjajaran Edisi 3, Matematik Tahap I',
  effectiveDate: '2024-05-03',
  status: 'draft-pending-academic-review',
  reviewer: null,
  sourceNote:
    'Scope paraphrased from the MathRacing KPM game plan (24 September 2026). Not a substitute for the official KPM document; ' +
    'a qualified Malaysian primary Mathematics educator must sign off every template before classroom deployment.',
  topics,
  // "Kira & taip": every question is a picture to count and one number (DECISIONS #42).
  templates: Y2_EASY_TEMPLATES,
};
