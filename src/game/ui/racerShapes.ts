import type { SpeedState } from '../core/cruise';
import type { PlayerStyle } from '../core/players';
import { racerInfo } from '../core/racers';
import type { RacerId } from '../core/racers';
import type { Direction } from './motion';

/**
 * Every racer as a list of simple parts (DECISIONS #39), drawn by the track (Phaser Graphics, `TrackView`) and by
 * the DOM screens (SVG, `app/art.ts`), so a pupil sees the same racer in Setup and on the track.
 *
 * Racer space: the unit is half the racer size, x points forward (right), y points down, the centre is 0,0.
 * The body stays inside x = -1.0..1.1 (`CAR_TAIL` / `CAR_NOSE` in `trackGeometry.ts`) with the nose as the
 * right-most point, so the track marks line up for every racer. Parts marked `fx` (the rocket flame) may reach
 * further back. Pure: no Phaser, no DOM.
 */

/** How a racer is drawn this frame; derived from its CarMotion. */
export type Pose = {
  direction: Direction;
  /** Cruise speed state; 'stopped' in step movement. */
  speedState: SpeedState;
  /** Signed speed in race steps per second. */
  speed: number;
  /** Body tilt in radians (positive = nose down). Applied by the renderer, not by the parts. */
  lean: number;
  /** Wheel rotation in radians (increases when rolling forward). */
  wheelAngle: number;
  /** Walking phase in radians for animals: one stride per 2π, driven by the distance travelled. */
  gait: number;
  /** Animation clock in ms (flame flicker, wing flaps, scarf flutter). */
  clock: number;
};

export const STILL_POSE: Pose = {
  direction: 'still',
  speedState: 'stopped',
  speed: 0,
  lean: 0,
  wheelAngle: 0,
  gait: 0,
  clock: 0,
};

export type Pt = readonly [number, number];

/** A colour is '#rrggbb'. `stroke` outlines the part with the racer's outline width; omitted = no outline. */
export type RacerPart =
  | { kind: 'poly'; pts: readonly Pt[]; fill: string; stroke?: string; fx?: boolean }
  | { kind: 'circle'; x: number; y: number; r: number; fill: string; stroke?: string }
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; fill: string; stroke?: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  /** White disc with the player's symbol in the player's colour. */
  | { kind: 'badge'; x: number; y: number; r: number };

/** Outline width in racer units (renderers keep a minimum in pixels). */
export const OUTLINE_WIDTH = 0.07;
/** Dark neutral outline for animals, so a white goose or grey rabbit stays visible on the grey road. */
export const ANIMAL_OUTLINE = '#1f2937';

/** Length of one animal stride, as a share of the racer size. */
const STRIDE = 0.25;

/** Walking phase for `travelledPx` pixels covered by a racer of `sizePx`. Frame-rate independent. */
export function gaitPhase(travelledPx: number, sizePx: number): number {
  return sizePx > 0 ? (travelledPx / (sizePx * STRIDE)) * Math.PI * 2 : 0;
}

export function racerKind(racer: RacerId): 'vehicle' | 'animal' {
  return racerInfo(racer).kind;
}

function mix(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number): number => {
    const c = (n >> shift) & 0xff;
    return Math.round(c + (255 - c) * amount);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

const poly = (pts: readonly Pt[], fill: string, stroke?: string): RacerPart =>
  stroke ? { kind: 'poly', pts, fill, stroke } : { kind: 'poly', pts, fill };
const circle = (x: number, y: number, r: number, fill: string, stroke?: string): RacerPart =>
  stroke ? { kind: 'circle', x, y, r, fill, stroke } : { kind: 'circle', x, y, r, fill };
const ellipse = (
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke?: string,
): RacerPart =>
  stroke
    ? { kind: 'ellipse', x, y, rx, ry, fill, stroke }
    : { kind: 'ellipse', x, y, rx, ry, fill };
const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): RacerPart => ({ kind: 'line', x1, y1, x2, y2, color, width });

/** Rotate and move a shape given relative to its pivot. */
const rotated = (pivot: Pt, pts: readonly Pt[], angle: number): Pt[] => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return pts.map(([x, y]) => [pivot[0] + x * c - y * s, pivot[1] + x * s + y * c] as const);
};
const moved = (pts: readonly Pt[], dx: number, dy: number): Pt[] =>
  pts.map(([x, y]) => [x + dx, y + dy] as const);

function wheel(x: number, y: number, pose: Pose, r = 0.26): RacerPart[] {
  const parts: RacerPart[] = [circle(x, y, r, '#111827')];
  // Spokes turn with the distance rolled, so the wheels visibly roll forward or backward.
  for (let k = 0; k < 3; k++) {
    const a = pose.wheelAngle + (k * Math.PI * 2) / 3;
    parts.push(
      line(x, y, x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, '#e5e7eb', r * 0.16),
    );
  }
  parts.push(circle(x, y, r * 0.42, '#e5e7eb'));
  return parts;
}

const badge = (x: number, y: number, r = 0.27): RacerPart => ({ kind: 'badge', x, y, r });

function vehicleParts(racer: RacerId, style: PlayerStyle, pose: Pose): RacerPart[] {
  const body = style.color;
  const dark = style.dark;
  const light = mix(style.color, 0.55);
  switch (racer) {
    case 'rocket': {
      const parts: RacerPart[] = [];
      if (
        pose.direction === 'forward' &&
        pose.speedState !== 'slow' &&
        pose.speedState !== 'crawl'
      ) {
        // The flame grows with speed (and is long while boosting), so a correct answer is visible.
        const boost = pose.speedState === 'boost' ? 0.3 : 0;
        const f = 0.2 + Math.min(0.4, pose.speed * 0.1 + boost) + 0.1 * Math.sin(pose.clock * 0.04);
        parts.push({
          kind: 'poly',
          pts: [
            [-0.9, -0.16],
            [-0.9 - f * 1.6, 0],
            [-0.9, 0.16],
          ],
          fill: '#fb923c',
          stroke: '#ea580c',
          fx: true,
        });
      }
      parts.push(
        poly(
          [
            [-0.55, -0.4],
            [-1.0, -0.9],
            [-0.85, -0.38],
          ],
          dark,
          dark,
        ),
        poly(
          [
            [-0.55, 0.4],
            [-1.0, 0.9],
            [-0.85, 0.38],
          ],
          dark,
          dark,
        ),
        poly(
          [
            [1.05, 0],
            [0.55, -0.44],
            [-0.7, -0.44],
            [-0.92, -0.2],
            [-0.92, 0.2],
            [-0.7, 0.44],
            [0.55, 0.44],
          ],
          body,
          dark,
        ),
        circle(0.5, 0, 0.2, '#bae6fd'),
        badge(-0.15, 0),
      );
      return parts;
    }
    case 'kart':
      return [
        poly(
          [
            [-0.9, 0.05],
            [-0.75, -0.22],
            [0.75, -0.22],
            [0.95, 0.05],
            [0.95, 0.42],
            [-0.9, 0.42],
          ],
          body,
          dark,
        ),
        circle(0.05, -0.32, 0.24, '#fde68a'),
        poly(
          [
            [0.55, -0.12],
            [0.85, 0.02],
            [0.55, 0.02],
          ],
          light,
          dark,
        ),
        ...wheel(-0.5, 0.42, pose),
        ...wheel(0.55, 0.42, pose),
        badge(-0.3, 0.14),
      ];
    case 'wedge':
      return [
        poly(
          [
            [1.0, 0.42],
            [-0.95, 0.42],
            [-0.95, -0.28],
            [0.1, -0.28],
          ],
          body,
          dark,
        ),
        poly(
          [
            [0.15, -0.2],
            [0.75, 0.16],
            [0.15, 0.16],
          ],
          light,
          dark,
        ),
        ...wheel(-0.55, 0.44, pose),
        ...wheel(0.55, 0.44, pose),
        badge(-0.5, 0.08),
      ];
    case 'saucer':
      return [
        circle(0.05, -0.18, 0.46, '#bae6fd', dark),
        ellipse(0, 0.12, 1.0, 0.31, body, dark),
        ...[-0.65, 0, 0.65].map((lx) => circle(lx, 0.16, 0.09, '#fde68a')),
        badge(0.05, -0.18),
      ];
    default:
      return [
        poly(
          [
            [-0.95, -0.4],
            [0.25, -0.4],
            [0.25, 0.42],
            [-0.95, 0.42],
          ],
          body,
          dark,
        ),
        poly(
          [
            [0.25, -0.12],
            [0.75, -0.12],
            [1.0, 0.12],
            [1.0, 0.42],
            [0.25, 0.42],
          ],
          mix(style.color, 0.25),
          dark,
        ),
        poly(
          [
            [0.42, -0.02],
            [0.72, -0.02],
            [0.86, 0.14],
            [0.42, 0.14],
          ],
          '#bae6fd',
          dark,
        ),
        ...wheel(-0.55, 0.44, pose),
        ...wheel(0.62, 0.44, pose),
        badge(-0.35, 0),
      ];
  }
}

/** Natural animal colours (DECISIONS #39): the same for every player; identity is on the scarf and badge. */
export const ANIMAL_COLORS = {
  duck: { body: '#facc15', wing: '#eab308', beak: '#f97316' },
  goose: { body: '#f8fafc', wing: '#cbd5e1', beak: '#f97316' },
  chicken: { body: '#d6a36a', wing: '#b7834d', beak: '#facc15', comb: '#dc2626', legs: '#f59e0b' },
  turtle: { shell: '#4d7c0f', plates: '#3f6212', skin: '#9caf88' },
  rabbit: { body: '#d1d5db', ear: '#f9a8d4', tail: '#ffffff', nose: '#f472b6' },
} as const;

const EYE = '#111827';

type Motion = {
  moving: boolean;
  boost: boolean;
  slow: boolean;
  crawl: boolean;
  /** Scarf-tail wave, 0 when still. */
  wave: number;
};

function motionOf(pose: Pose): Motion {
  const moving = pose.direction !== 'still' || pose.speedState !== 'stopped';
  return {
    moving,
    boost: pose.speedState === 'boost',
    slow: pose.speedState === 'slow',
    crawl: pose.speedState === 'crawl',
    wave: moving && pose.speedState !== 'crawl' ? Math.sin(pose.clock * 0.02) * 0.06 : 0,
  };
}

/** The player's identity on an animal: a scarf band with a tail flying back, and a ringed badge. */
function scarf(style: PlayerStyle, band: readonly Pt[], knot: Pt, m: Motion): RacerPart[] {
  const [kx, ky] = knot;
  const trail = m.moving ? 0.12 : 0;
  return [
    poly(band, style.color, ANIMAL_OUTLINE),
    poly(
      [
        [kx, ky - 0.07],
        [kx - 0.34 - trail, ky + m.wave],
        [kx - 0.28 - trail, ky + 0.18 + m.wave],
        [kx, ky + 0.09],
      ],
      style.color,
      ANIMAL_OUTLINE,
    ),
  ];
}

function ringedBadge(style: PlayerStyle, x: number, y: number): RacerPart[] {
  return [circle(x, y, 0.3, style.color, ANIMAL_OUTLINE), badge(x, y, 0.23)];
}

/** Two legs stepping in turn, with a foot at the end of each. */
function legs(
  hips: readonly [Pt, Pt],
  groundY: number,
  pose: Pose,
  m: Motion,
  color: string,
  reach: number,
  foot: (x: number, y: number) => RacerPart[],
): RacerPart[] {
  const parts: RacerPart[] = [];
  hips.forEach(([hx, hy], i) => {
    const phase = pose.gait + i * Math.PI;
    const swing = m.moving ? Math.sin(phase) * reach * (m.slow ? 0.5 : 1) : 0;
    const lift = m.moving ? Math.max(0, Math.cos(phase)) * 0.08 : 0;
    const fx = hx + swing;
    const fy = groundY - lift;
    parts.push(line(hx, hy, fx, fy, color, 0.07), ...foot(fx, fy));
  });
  return parts;
}

/** Wing folded against the body, or flapping while boosting. `pts` are relative to the shoulder. */
function wing(shoulder: Pt, pts: readonly Pt[], fill: string, pose: Pose, m: Motion): RacerPart {
  const angle = m.boost ? -0.55 + 0.45 * Math.sin(pose.clock * 0.035) : 0;
  return poly(rotated(shoulder, pts, angle), fill, ANIMAL_OUTLINE);
}

const WING: readonly Pt[] = [
  [0.1, 0],
  [-0.2, -0.12],
  [-0.62, -0.06],
  [-0.5, 0.12],
  [-0.08, 0.16],
];

function webbedFoot(color: string): (x: number, y: number) => RacerPart[] {
  return (x, y) => [
    poly(
      [
        [x - 0.08, y],
        [x + 0.2, y],
        [x + 0.02, y - 0.1],
      ],
      color,
      ANIMAL_OUTLINE,
    ),
  ];
}

function duckParts(style: PlayerStyle, pose: Pose): RacerPart[] {
  const c = ANIMAL_COLORS.duck;
  const m = motionOf(pose);
  const bob = m.moving ? 0 - Math.abs(Math.sin(pose.gait)) * 0.05 : 0;
  const drop = m.slow ? 0.1 : 0;
  return [
    ...legs(
      [
        [-0.25, 0.35],
        [0.0, 0.35],
      ],
      0.64,
      pose,
      m,
      c.beak,
      0.16,
      webbedFoot(c.beak),
    ),
    poly(
      moved(
        [
          [-0.72, -0.02],
          [-1.0, -0.26],
          [-0.8, 0.16],
        ],
        0,
        bob,
      ),
      c.body,
      ANIMAL_OUTLINE,
    ),
    ellipse(-0.15, 0.1 + bob, 0.72, 0.36, c.body, ANIMAL_OUTLINE),
    wing([-0.02, 0.0 + bob], WING, c.wing, pose, m),
    ...ringedBadge(style, -0.42, 0.14 + bob),
    circle(0.5, -0.3 + bob + drop, 0.28, c.body, ANIMAL_OUTLINE),
    ...scarf(
      style,
      moved(
        [
          [0.3, -0.14],
          [0.62, -0.06],
          [0.58, 0.07],
          [0.26, -0.01],
        ],
        0,
        bob,
      ),
      [0.36, -0.06 + bob],
      m,
    ),
    poly(
      moved(
        [
          [0.72, -0.36],
          [1.05, -0.28],
          [0.74, -0.2],
        ],
        0,
        bob + drop,
      ),
      c.beak,
      ANIMAL_OUTLINE,
    ),
    circle(0.58, -0.38 + bob + drop, 0.055, EYE),
  ];
}

function gooseParts(style: PlayerStyle, pose: Pose): RacerPart[] {
  const c = ANIMAL_COLORS.goose;
  const m = motionOf(pose);
  const bob = m.moving ? 0 - Math.abs(Math.sin(pose.gait)) * 0.04 : 0;
  // Neck stretched forward while boosting, head low while slowed.
  const hx = m.boost ? 0.06 : 0;
  const hy = (m.slow ? 0.16 : 0) + (m.boost ? 0.06 : 0);
  return [
    ...legs(
      [
        [-0.3, 0.36],
        [-0.05, 0.36],
      ],
      0.64,
      pose,
      m,
      c.beak,
      0.16,
      webbedFoot(c.beak),
    ),
    poly(
      moved(
        [
          [-0.78, 0.0],
          [-1.0, -0.2],
          [-0.84, 0.18],
        ],
        0,
        bob,
      ),
      c.body,
      ANIMAL_OUTLINE,
    ),
    ellipse(-0.22, 0.14 + bob, 0.7, 0.34, c.body, ANIMAL_OUTLINE),
    poly(
      [
        [0.22, 0.02 + bob],
        [0.5 + hx, -0.52 + bob + hy],
        [0.7 + hx, -0.5 + bob + hy],
        [0.44, 0.1 + bob],
      ],
      c.body,
      ANIMAL_OUTLINE,
    ),
    wing([-0.08, 0.04 + bob], WING, c.wing, pose, m),
    ...ringedBadge(style, -0.46, 0.16 + bob),
    circle(0.64 + hx, -0.6 + bob + hy, 0.2, c.body, ANIMAL_OUTLINE),
    ...scarf(
      style,
      [
        [0.28, -0.12 + bob],
        [0.55, -0.1 + bob],
        [0.54, 0.02 + bob],
        [0.24, 0.0 + bob],
      ],
      [0.32, -0.06 + bob],
      m,
    ),
    poly(
      [
        [0.8 + hx, -0.66 + bob + hy],
        [1.05 + hx * 0.5, -0.58 + bob + hy],
        [0.8 + hx, -0.5 + bob + hy],
      ],
      c.beak,
      ANIMAL_OUTLINE,
    ),
    circle(0.7 + hx, -0.66 + bob + hy, 0.045, EYE),
  ];
}

function chickenParts(style: PlayerStyle, pose: Pose): RacerPart[] {
  const c = ANIMAL_COLORS.chicken;
  const m = motionOf(pose);
  const bob = m.moving ? 0 - Math.abs(Math.sin(pose.gait)) * 0.06 : 0;
  const drop = m.slow ? 0.1 : 0;
  const toes = (x: number, y: number): RacerPart[] => [
    line(x, y, x + 0.14, y, c.legs, 0.05),
    line(x, y, x - 0.08, y, c.legs, 0.05),
  ];
  return [
    ...legs(
      [
        [-0.22, 0.38],
        [0.02, 0.38],
      ],
      0.66,
      pose,
      m,
      c.legs,
      0.2,
      toes,
    ),
    poly(
      moved(
        [
          [-0.6, -0.02],
          [-0.92, -0.48],
          [-0.8, -0.14],
          [-1.0, -0.24],
          [-0.7, 0.16],
        ],
        0,
        bob,
      ),
      c.wing,
      ANIMAL_OUTLINE,
    ),
    ellipse(-0.15, 0.08 + bob, 0.58, 0.38, c.body, ANIMAL_OUTLINE),
    wing([0.0, 0.0 + bob], WING, c.wing, pose, m),
    ...ringedBadge(style, -0.34, 0.14 + bob),
    ...[0.34, 0.45, 0.56].map((cx, i) =>
      circle(cx, -0.6 + bob + drop + (i === 1 ? -0.04 : 0), 0.08, c.comb, ANIMAL_OUTLINE),
    ),
    circle(0.46, -0.36 + bob + drop, 0.24, c.body, ANIMAL_OUTLINE),
    circle(0.64, -0.16 + bob + drop, 0.07, c.comb),
    ...scarf(
      style,
      moved(
        [
          [0.26, -0.18],
          [0.58, -0.1],
          [0.54, 0.02],
          [0.22, -0.06],
        ],
        0,
        bob,
      ),
      [0.3, -0.1 + bob],
      m,
    ),
    poly(
      moved(
        [
          [0.66, -0.42],
          [0.95, -0.34],
          [0.66, -0.26],
        ],
        0,
        bob + drop,
      ),
      c.beak,
      ANIMAL_OUTLINE,
    ),
    circle(0.52, -0.42 + bob + drop, 0.05, EYE),
  ];
}

function turtleParts(style: PlayerStyle, pose: Pose): RacerPart[] {
  const c = ANIMAL_COLORS.turtle;
  const m = motionOf(pose);
  // Head out while boosting, pulled in while slowed.
  const head = m.boost ? 0.08 : m.slow ? -0.1 : 0;
  const paddle = (i: number): number => (m.moving ? Math.sin(pose.gait + i * Math.PI) * 0.09 : 0);
  return [
    ellipse(0.36 + paddle(0), 0.44, 0.16, 0.11, c.skin, ANIMAL_OUTLINE),
    ellipse(-0.5 + paddle(1), 0.44, 0.16, 0.11, c.skin, ANIMAL_OUTLINE),
    poly(
      [
        [-0.72, 0.28],
        [-0.92, 0.36],
        [-0.72, 0.4],
      ],
      c.skin,
      ANIMAL_OUTLINE,
    ),
    poly(
      [
        [0.5, 0.12],
        [0.62 + head, 0.02],
        [0.74 + head, 0.26],
        [0.5, 0.34],
      ],
      c.skin,
      ANIMAL_OUTLINE,
    ),
    ellipse(0.8 + head, 0.12, 0.22, 0.17, c.skin, ANIMAL_OUTLINE),
    circle(0.88 + head, 0.06, 0.045, EYE),
    poly(
      [
        [-0.8, 0.4],
        [-0.72, -0.06],
        [-0.38, -0.36],
        [0.1, -0.4],
        [0.46, -0.16],
        [0.62, 0.4],
      ],
      c.shell,
      ANIMAL_OUTLINE,
    ),
    poly(
      [
        [-0.68, 0.34],
        [-0.62, 0.12],
        [-0.46, 0.2],
        [-0.5, 0.36],
      ],
      c.plates,
    ),
    poly(
      [
        [0.3, 0.36],
        [0.26, 0.14],
        [0.44, 0.08],
        [0.52, 0.36],
      ],
      c.plates,
    ),
    // saddle cloth in the player's colour carries the badge
    poly(
      [
        [-0.52, -0.2],
        [0.18, -0.3],
        [0.34, 0.2],
        [-0.56, 0.24],
      ],
      style.color,
      ANIMAL_OUTLINE,
    ),
    badge(-0.1, 0.0, 0.25),
  ];
}

function rabbitParts(style: PlayerStyle, pose: Pose): RacerPart[] {
  const c = ANIMAL_COLORS.rabbit;
  const m = motionOf(pose);
  // Hops: one hop per stride, lower while slowed, none while still.
  const hop = m.moving
    ? 0 - Math.abs(Math.sin(pose.gait / 2)) * (m.slow || m.crawl ? 0.08 : 0.2)
    : 0;
  const drop = m.slow ? 0.08 : 0;
  // Ears lie back while boosting.
  const back = m.boost ? 0.35 : m.slow ? 0.15 : 0;
  const ear = (dx: number): Pt[] =>
    rotated(
      [0.42 + dx, -0.36 + hop + drop],
      [
        [-0.06, 0],
        [-0.14, -0.58],
        [0.04, -0.62],
        [0.1, 0],
      ],
      0 - back,
    );
  const inner = (dx: number): Pt[] =>
    rotated(
      [0.42 + dx, -0.36 + hop + drop],
      [
        [-0.02, -0.06],
        [-0.08, -0.5],
        [0.02, -0.52],
        [0.05, -0.06],
      ],
      0 - back,
    );
  return [
    poly(ear(-0.12), c.body, ANIMAL_OUTLINE),
    ellipse(-0.42, 0.42 + hop * 0.5, 0.3, 0.16, c.body, ANIMAL_OUTLINE),
    ellipse(-0.1, 0.12 + hop, 0.58, 0.34, c.body, ANIMAL_OUTLINE),
    circle(-0.7, 0.02 + hop, 0.13, c.tail, ANIMAL_OUTLINE),
    ellipse(0.36, 0.48 + hop * 0.3, 0.14, 0.09, c.body, ANIMAL_OUTLINE),
    ...ringedBadge(style, -0.2, 0.12 + hop),
    ellipse(0.55, -0.18 + hop + drop, 0.32, 0.26, c.body, ANIMAL_OUTLINE),
    poly(ear(0.02), c.body, ANIMAL_OUTLINE),
    poly(inner(0.02), c.ear),
    ...scarf(
      style,
      [
        [0.22, -0.02 + hop],
        [0.5, 0.04 + hop],
        [0.46, 0.16 + hop],
        [0.18, 0.1 + hop],
      ],
      [0.26, 0.06 + hop],
      m,
    ),
    circle(0.88, -0.16 + hop + drop, 0.06, c.nose),
    circle(0.64, -0.24 + hop + drop, 0.05, EYE),
  ];
}

/** The parts of `racer` for `style` in `pose`, back to front. */
export function racerParts(racer: RacerId, style: PlayerStyle, pose: Pose): RacerPart[] {
  switch (racer) {
    case 'duck':
      return duckParts(style, pose);
    case 'goose':
      return gooseParts(style, pose);
    case 'chicken':
      return chickenParts(style, pose);
    case 'turtle':
      return turtleParts(style, pose);
    case 'rabbit':
      return rabbitParts(style, pose);
    default:
      return vehicleParts(racer, style, pose);
  }
}

/** Horizontal and vertical reach of the body (parts marked `fx` excluded), in racer units. */
export function partsBounds(parts: readonly RacerPart[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const add = (x0: number, x1: number, y0: number, y1: number): void => {
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    minY = Math.min(minY, y0);
    maxY = Math.max(maxY, y1);
  };
  for (const p of parts) {
    switch (p.kind) {
      case 'poly':
        if (p.fx) break;
        for (const [x, y] of p.pts) add(x, x, y, y);
        break;
      case 'circle':
      case 'badge':
        add(p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r);
        break;
      case 'ellipse':
        add(p.x - p.rx, p.x + p.rx, p.y - p.ry, p.y + p.ry);
        break;
      case 'line':
        add(Math.min(p.x1, p.x2), Math.max(p.x1, p.x2), Math.min(p.y1, p.y2), Math.max(p.y1, p.y2));
        break;
    }
  }
  return { minX, maxX, minY, maxY };
}
