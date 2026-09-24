import { MAX_PLAYERS, styleForSlot } from './players';

/**
 * What a pupil races with (DECISIONS #39). The racer is only a costume: colour, symbol and lane number stay tied to
 * the player's slot, and two active players never share a racer. The ids are stable (saved in settings and
 * exported in the CSV `racer` column), so never rename one.
 */
export type RacerId =
  | 'rocket'
  | 'kart'
  | 'wedge'
  | 'saucer'
  | 'block'
  | 'duck'
  | 'goose'
  | 'chicken'
  | 'turtle'
  | 'rabbit';

export type RacerKind = 'vehicle' | 'animal';

export type RacerInfo = { id: RacerId; kind: RacerKind; name: { bm: string; en: string } };

export const RACERS: readonly RacerInfo[] = [
  { id: 'rocket', kind: 'vehicle', name: { bm: 'Roket', en: 'Rocket' } },
  { id: 'kart', kind: 'vehicle', name: { bm: 'Kart', en: 'Kart' } },
  { id: 'wedge', kind: 'vehicle', name: { bm: 'Kereta laju', en: 'Sports car' } },
  { id: 'saucer', kind: 'vehicle', name: { bm: 'Piring terbang', en: 'Flying saucer' } },
  { id: 'block', kind: 'vehicle', name: { bm: 'Van', en: 'Van' } },
  { id: 'duck', kind: 'animal', name: { bm: 'Itik', en: 'Duck' } },
  { id: 'goose', kind: 'animal', name: { bm: 'Angsa', en: 'Goose' } },
  { id: 'chicken', kind: 'animal', name: { bm: 'Ayam', en: 'Chicken' } },
  { id: 'turtle', kind: 'animal', name: { bm: 'Penyu', en: 'Turtle' } },
  { id: 'rabbit', kind: 'animal', name: { bm: 'Arnab', en: 'Rabbit' } },
];

export function isRacerId(v: unknown): v is RacerId {
  return typeof v === 'string' && RACERS.some((r) => r.id === v);
}

export function racerInfo(id: RacerId): RacerInfo {
  const info = RACERS.find((r) => r.id === id);
  if (!info) throw new RangeError(`Unknown racer ${id}`);
  return info;
}

/** Today's fixed vehicle for the slot: the racer used until a pupil picks another one. */
export function defaultRacerForSlot(slot: number): RacerId {
  return styleForSlot(slot).defaultRacer;
}

export function defaultRacers(): RacerId[] {
  return Array.from({ length: MAX_PLAYERS }, (_, i) => defaultRacerForSlot(i));
}

/** Racers held by the other active players (slots below `playerCount`, except `exceptSlot`). */
export function takenRacers(
  racers: readonly RacerId[],
  playerCount: number,
  exceptSlot: number,
): Set<RacerId> {
  const taken = new Set<RacerId>();
  for (let i = 0; i < Math.min(playerCount, racers.length); i++) {
    const r = racers[i];
    if (i !== exceptSlot && r) taken.add(r);
  }
  return taken;
}

/**
 * One valid racer per slot (always `MAX_PLAYERS` entries): unknown values become the slot default, and among the
 * active slots (below `playerCount`) a clash is resolved in slot order: the later slot gets its default racer, or
 * the first free one when that is taken too. Inactive slots keep their saved choice.
 */
export function resolveRacers(raw: unknown, playerCount: number = MAX_PLAYERS): RacerId[] {
  const list = Array.isArray(raw) ? (raw as unknown[]) : [];
  const out = Array.from({ length: MAX_PLAYERS }, (_, i) => {
    const v = list[i];
    return isRacerId(v) ? v : defaultRacerForSlot(i);
  });
  const active = Math.min(playerCount, MAX_PLAYERS);
  const used = new Set<RacerId>();
  for (let i = 0; i < active; i++) {
    const r = out[i] as RacerId;
    if (!used.has(r)) {
      used.add(r);
      continue;
    }
    // A replacement must not take what a later active slot already holds.
    const later = new Set(out.slice(i + 1, active));
    const free = (id: RacerId): boolean => !used.has(id) && !later.has(id);
    const fallback = defaultRacerForSlot(i);
    const next = free(fallback) ? fallback : (RACERS.find((x) => free(x.id))?.id ?? fallback);
    out[i] = next;
    used.add(next);
  }
  return out;
}
