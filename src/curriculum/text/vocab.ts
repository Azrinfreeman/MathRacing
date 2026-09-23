import type { Language, LocalText } from '../schema';
import { pickText } from '../schema';
import type { Shape2D, Shape3D } from '../visual';

/** Number words, Bahasa Melayu and British English, for 0..1000. */
const BM_UNITS = [
  'sifar',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'lapan',
  'sembilan',
];
const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const EN_TEENS = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

function bmWords(n: number): string {
  if (n < 10) return BM_UNITS[n] as string;
  if (n === 10) return 'sepuluh';
  if (n === 11) return 'sebelas';
  if (n < 20) return `${BM_UNITS[n - 10]} belas`;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return `${BM_UNITS[t]} puluh${u > 0 ? ` ${BM_UNITS[u]}` : ''}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const head = h === 1 ? 'seratus' : `${BM_UNITS[h]} ratus`;
    return rest > 0 ? `${head} ${bmWords(rest)}` : head;
  }
  if (n === 1000) return 'seribu';
  throw new RangeError(`numberToWords supports 0..1000, got ${n}`);
}

function enWords(n: number): string {
  if (n < 10) return EN_UNITS[n] as string;
  if (n < 20) return EN_TEENS[n - 10] as string;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return `${EN_TENS[t]}${u > 0 ? `-${EN_UNITS[u]}` : ''}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return rest > 0 ? `${EN_UNITS[h]} hundred and ${enWords(rest)}` : `${EN_UNITS[h]} hundred`;
  }
  if (n === 1000) return 'one thousand';
  throw new RangeError(`numberToWords supports 0..1000, got ${n}`);
}

export function numberToWords(n: number, language: Language): string {
  if (!Number.isInteger(n) || n < 0 || n > 1000)
    throw new RangeError(`numberToWords supports 0..1000, got ${n}`);
  return language === 'en' ? enWords(n) : bmWords(n);
}

export const DAYS: readonly LocalText[] = [
  { bm: 'Isnin', en: 'Monday' },
  { bm: 'Selasa', en: 'Tuesday' },
  { bm: 'Rabu', en: 'Wednesday' },
  { bm: 'Khamis', en: 'Thursday' },
  { bm: 'Jumaat', en: 'Friday' },
  { bm: 'Sabtu', en: 'Saturday' },
  { bm: 'Ahad', en: 'Sunday' },
];

export const MONTHS: readonly LocalText[] = [
  { bm: 'Januari', en: 'January' },
  { bm: 'Februari', en: 'February' },
  { bm: 'Mac', en: 'March' },
  { bm: 'April', en: 'April' },
  { bm: 'Mei', en: 'May' },
  { bm: 'Jun', en: 'June' },
  { bm: 'Julai', en: 'July' },
  { bm: 'Ogos', en: 'August' },
  { bm: 'September', en: 'September' },
  { bm: 'Oktober', en: 'October' },
  { bm: 'November', en: 'November' },
  { bm: 'Disember', en: 'December' },
];

export const SHAPE2D_NAMES: Record<Shape2D, LocalText> = {
  triangle: { bm: 'Segi tiga', en: 'Triangle' },
  square: { bm: 'Segi empat sama', en: 'Square' },
  rectangle: { bm: 'Segi empat tepat', en: 'Rectangle' },
  circle: { bm: 'Bulatan', en: 'Circle' },
  pentagon: { bm: 'Pentagon', en: 'Pentagon' },
  hexagon: { bm: 'Heksagon', en: 'Hexagon' },
  octagon: { bm: 'Oktagon', en: 'Octagon' },
};

export const SHAPE3D_NAMES: Record<Shape3D, LocalText> = {
  cube: { bm: 'Kubus', en: 'Cube' },
  cuboid: { bm: 'Kuboid', en: 'Cuboid' },
  cylinder: { bm: 'Silinder', en: 'Cylinder' },
  cone: { bm: 'Kon', en: 'Cone' },
  sphere: { bm: 'Sfera', en: 'Sphere' },
  pyramid: { bm: 'Piramid', en: 'Pyramid' },
};

/** Number of straight sides of the polygons (circle has none). */
export const SHAPE2D_SIDES: Record<Shape2D, number> = {
  triangle: 3,
  square: 4,
  rectangle: 4,
  circle: 0,
  pentagon: 5,
  hexagon: 6,
  octagon: 8,
};

export const FRUITS: readonly LocalText[] = [
  { bm: 'Mangga', en: 'Mango' },
  { bm: 'Epal', en: 'Apple' },
  { bm: 'Pisang', en: 'Banana' },
  { bm: 'Oren', en: 'Orange' },
  { bm: 'Betik', en: 'Papaya' },
  { bm: 'Tembikai', en: 'Watermelon' },
];

export const PETS: readonly LocalText[] = [
  { bm: 'Kucing', en: 'Cat' },
  { bm: 'Ikan', en: 'Fish' },
  { bm: 'Burung', en: 'Bird' },
  { bm: 'Arnab', en: 'Rabbit' },
  { bm: 'Hamster', en: 'Hamster' },
];

/** Colour-blind-considerate object colours (shape carries the meaning as well). */
export const OBJECT_COLORS = [
  '#e4572e',
  '#2e86de',
  '#2fb344',
  '#9b51e0',
  '#f2a900',
  '#0aa5a5',
] as const;

export function text(language: Language, t: LocalText): string {
  return pickText(language, t);
}

/** Format whole ringgit as text, e.g. 5 -> "RM5". */
export function rm(value: number): string {
  return `RM${value}`;
}

export function senText(value: number): string {
  return `${value} sen`;
}
