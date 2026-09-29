import type { CurriculumPack, CurriculumTopic } from '../schema';
import { Y1_EASY_TEMPLATES } from '../generators/easyY1';

/**
 * Topic codes and SK ranges are copied from section 5 of the KPM game plan
 * (output/pdf/MathRacing_KPM_Year1_Year2_Game_Plan.pdf). The plan lists SK ranges per topic but no SP codes,
 * so every template carries the topic's SK range and an empty SP list until a reviewer supplies verified codes.
 */
const topics: CurriculumTopic[] = [
  {
    id: 'y1-numbers',
    year: 1,
    code: '1.0',
    title: { bm: 'Nombor Bulat hingga 100', en: 'Whole Numbers to 100' },
    standardKandungan: '1.1-1.5',
    scope:
      'Compare quantities; name, count and write numbers; compare groups; place value and digit value; patterns by 1, 2, 5 and 10; one-digit number combinations.',
  },
  {
    id: 'y1-operations',
    year: 1,
    code: '2.0',
    title: { bm: 'Operasi Asas', en: 'Basic Operations' },
    standardKandungan: '2.1-2.5',
    scope:
      'Meaning and symbols of +, - and =; addition and subtraction within 100; repeated addition by 2, 5 and 10; repeated subtraction by 2, 5 and 10.',
  },
  {
    id: 'y1-money',
    year: 1,
    code: '3.0',
    title: { bm: 'Wang', en: 'Money' },
    standardKandungan: '3.1-3.2',
    scope:
      'Recognise Malaysian coins and notes; represent and exchange sen to RM1 and ringgit to RM10; add and subtract money within RM10.',
  },
  {
    id: 'y1-time',
    year: 1,
    code: '4.0',
    title: { bm: 'Masa', en: 'Time' },
    standardKandungan: '4.1-4.2',
    scope:
      'Order daily events; days of the week; months of the year; hour and minute hands; tell and write hour, half-hour and quarter-hour on an analogue clock.',
  },
  {
    id: 'y1-measurement',
    year: 1,
    code: '5.0',
    title: { bm: 'Sukatan', en: 'Measurement' },
    standardKandungan: '5.1',
    scope:
      'Measure and compare length, mass and liquid volume using non-standard units and comparative language.',
  },
  {
    id: 'y1-space',
    year: 1,
    code: '6.0',
    title: { bm: 'Ruang', en: 'Space' },
    standardKandungan: '6.1-6.2',
    scope:
      'Name and describe 3D and 2D shapes; count faces, sides, vertices, corners and curves; continue shape patterns; combine shapes.',
  },
  {
    id: 'y1-data',
    year: 1,
    code: '7.0',
    title: { bm: 'Pengurusan Data', en: 'Data Management' },
    standardKandungan: '7.1-7.2',
    scope:
      'Collect, classify and arrange everyday data; read pictographs where one picture represents one value.',
  },
];

export const KPM_MS_Y1_V1: CurriculumPack = {
  packId: 'kpm-ms-y1',
  version: '2.0.1',
  year: 1,
  title: {
    bm: 'KSSR (Semakan 2017) - Edisi 3 - Matematik Tahun 1',
    en: 'KSSR (Revised 2017) - Edition 3 - Mathematics Year 1',
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
  templates: Y1_EASY_TEMPLATES,
};
