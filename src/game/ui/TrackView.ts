import type * as Phaser from 'phaser';
import type { Translator } from '../../locales';
import type { PlayerStyle, VehicleId } from '../core/players';
import { TextPool } from './DrawContext';
import type { Rect } from './geometry';
import { CarMotion } from './motion';
import type { Direction } from './motion';
import { drawSymbol } from './shapes';
import { computeTrackGeometry } from './trackGeometry';
import type { TrackGeometry } from './trackGeometry';
import { THEME, hexToNumber, lighten } from './theme';

export type TrackPlayer = { id: string; name: string; style: PlayerStyle };

/** How a racer is drawn this frame; derived from its CarMotion. */
type Pose = {
  direction: Direction;
  /** Signed speed in race steps per second. */
  speed: number;
  /** Body tilt in radians (positive = nose down). */
  lean: number;
  /** Wheel rotation in radians (increases when rolling forward). */
  wheelAngle: number;
};

const STILL_POSE: Pose = { direction: 'still', speed: 0, lean: 0, wheelAngle: 0 };

/** A short-lived puff of dust or exhaust. Pooled: the array is fixed-size and reused. */
type Puff = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  color: number;
  alpha: number;
};

const MAX_PUFFS = 120;
const LEAN_LIMIT = 0.14;
const TRAIL_COLOR = 0xe2e8f0;
// Neutral warm grey for a setback: deliberately not red and never a warning colour.
const DUST_COLOR = 0xd6c7a8;

type Confetti = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  spin: number;
  phase: number;
};

const CONFETTI_COLORS = [0xf59e0b, 0x22c55e, 0x3b82f6, 0xec4899, 0xa855f7, 0xef4444, 0x14b8a6];

/**
 * The shared race track across the top of the screen: one lane per player, START and a checkered FINISH,
 * racers with distinct silhouettes, a countdown and a short winner celebration. All motion is time-based
 * (delta milliseconds), so it never depends on the frame rate.
 */
export class TrackView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly pool: TextPool;
  private rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private readonly motion = new Map<string, CarMotion>();
  private readonly emitAcc = new Map<string, number>();
  private readonly puffs: Puff[] = Array.from({ length: MAX_PUFFS }, () => ({
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    size: 0,
    grow: 0,
    color: 0,
    alpha: 0,
  }));
  private clock = 0;
  private confetti: Confetti[] = [];
  private banner: { text: string; sub: string; winnerId: string | null } | null = null;
  private countdown: string | null = null;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    private readonly players: readonly TrackPlayer[],
    private readonly raceLength: number,
    private t: Translator,
    private reducedMotion: boolean,
    depth = 4,
  ) {
    this.g = scene.add.graphics().setDepth(depth);
    this.pool = new TextPool(scene, depth + 1);
    for (const p of players) {
      this.motion.set(p.id, new CarMotion());
      this.emitAcc.set(p.id, 0);
    }
  }

  setRect(rect: Rect): void {
    this.rect = rect;
  }

  setTranslator(t: Translator): void {
    this.t = t;
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) for (const puff of this.puffs) puff.alive = false;
  }

  /** Move a racer to `progress` steps. The car drives forward or rolls backward depending on the change. */
  setProgress(playerId: string, progress: number, immediate = false): void {
    this.motion.get(playerId)?.setTarget(progress, this.reducedMotion, immediate);
  }

  /** The position a racer is drawn at, in steps (fractional while moving). For tests and diagnostics. */
  shownProgress(playerId: string): number {
    return this.motion.get(playerId)?.progress ?? 0;
  }

  showCountdown(text: string | null): void {
    this.countdown = text;
  }

  celebrate(winnerId: string | null, title: string, subtitle = ''): void {
    this.banner = { text: title, sub: subtitle, winnerId };
    this.confetti = [];
    if (this.reducedMotion) return;
    const { x, y, w } = this.rect;
    for (let i = 0; i < 90; i++) {
      this.confetti.push({
        x: x + Math.random() * w,
        y: y - Math.random() * this.rect.h * 0.6,
        vx: (Math.random() - 0.5) * 0.12,
        vy: 0.05 + Math.random() * 0.12,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] as number,
        spin: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  clearCelebration(): void {
    this.banner = null;
    this.confetti = [];
  }

  /** Advance animation by `dtMs` and redraw. */
  update(dtMs: number): void {
    if (this.destroyed) return;
    this.clock += dtMs;
    this.players.forEach((p, i) => {
      const m = this.motion.get(p.id);
      if (!m) return;
      m.step(dtMs, this.reducedMotion);
      if (!this.reducedMotion) this.emitPuffs(p.id, i, m, dtMs);
    });
    this.stepPuffs(dtMs);
    for (const c of this.confetti) {
      c.x += c.vx * dtMs + Math.sin(this.clock * 0.004 + c.phase) * 0.4;
      c.y += c.vy * dtMs;
      c.spin += dtMs * 0.006;
      if (c.y > this.rect.y + this.rect.h + 20) c.y = this.rect.y - 10;
    }
    this.render();
  }

  private geometry(): TrackGeometry {
    return computeTrackGeometry(this.rect, this.players.length, this.raceLength);
  }

  /** Where a racer's lane, size and position are, from its displayed progress. */
  private racerGeometry(
    index: number,
    progressSteps: number,
    geo: TrackGeometry = this.geometry(),
  ): { x: number; baseY: number; size: number; stepPx: number } {
    return {
      x: geo.carXAt(progressSteps),
      baseY: geo.top + index * geo.laneH + geo.laneH * 0.68,
      size: geo.carSize,
      stepPx: geo.stepPx,
    };
  }

  private poseOf(m: CarMotion, size: number, stepPx: number): Pose {
    if (this.reducedMotion) return STILL_POSE;
    const lean = Math.max(-LEAN_LIMIT, Math.min(LEAN_LIMIT, -m.accel / 1200)) + m.wobble * 0.06;
    const wheelRadius = (size / 2) * 0.26;
    return {
      direction: m.direction,
      speed: m.velocity,
      lean,
      wheelAngle: (m.travelled * stepPx) / wheelRadius,
    };
  }

  private spawnPuff(init: Partial<Puff> & Pick<Puff, 'x' | 'y' | 'life' | 'size' | 'color'>): void {
    const slot = this.puffs.find((p) => !p.alive);
    if (!slot) return;
    slot.alive = true;
    slot.age = 0;
    slot.vx = 0;
    slot.vy = 0;
    slot.grow = 0;
    slot.alpha = 0.5;
    Object.assign(slot, init);
  }

  /** Exhaust behind a car driving forward; a small dust puff at the front bumper while it rolls back. */
  private emitPuffs(id: string, index: number, m: CarMotion, dtMs: number): void {
    const speed = Math.abs(m.velocity);
    if (!m.moving || speed < 0.15 || dtMs <= 0) return;
    const forward = m.velocity > 0;
    const rate = forward ? 22 * Math.min(1, speed / 3) : 12 * Math.min(1, speed / 1.5);
    let acc = (this.emitAcc.get(id) ?? 0) + (rate * dtMs) / 1000;
    const { x, baseY, size } = this.racerGeometry(index, m.progress);
    while (acc >= 1) {
      acc -= 1;
      const jitter = (Math.random() - 0.5) * size * 0.12;
      if (forward) {
        this.spawnPuff({
          x: x - size * 0.5,
          y: baseY + size * 0.22 + jitter,
          vx: -size * 0.0006,
          vy: -size * 0.0002,
          size: size * 0.07,
          grow: size * 0.00018,
          life: 420,
          color: TRAIL_COLOR,
          alpha: 0.55,
        });
      } else {
        this.spawnPuff({
          x: x + size * 0.45,
          y: baseY + size * 0.3 + jitter,
          vx: size * 0.0003,
          vy: -size * 0.00015,
          size: size * 0.06,
          grow: size * 0.00014,
          life: 520,
          color: DUST_COLOR,
          alpha: 0.5,
        });
      }
    }
    this.emitAcc.set(id, acc);
  }

  private stepPuffs(dtMs: number): void {
    for (const p of this.puffs) {
      if (!p.alive) continue;
      p.age += dtMs;
      if (p.age >= p.life) {
        p.alive = false;
        continue;
      }
      p.x += p.vx * dtMs;
      p.y += p.vy * dtMs;
      p.size += p.grow * dtMs;
    }
  }

  private drawPuffs(): void {
    const { g } = this;
    for (const p of this.puffs) {
      if (!p.alive) continue;
      g.fillStyle(p.color, p.alpha * (1 - p.age / p.life));
      g.fillCircle(p.x, p.y, p.size);
    }
  }

  private render(): void {
    const { g, rect } = this;
    g.clear();
    this.pool.begin();

    // sky and horizon
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      g.fillStyle(lighten('#0ea5e9', 0.05 + t * 0.55), 1);
      g.fillRect(rect.x, rect.y + (rect.h * i) / bands, rect.w, rect.h / bands + 1);
    }
    const geo = this.geometry();
    const { top, laneH, startLineX, finishLineX, checkerW } = geo;
    const lanesH = laneH * this.players.length;
    // asphalt
    g.fillStyle(THEME.track, 1);
    g.fillRoundedRect(
      rect.x + rect.w * 0.01,
      top - laneH * 0.04,
      rect.w * 0.98,
      lanesH + laneH * 0.08,
      laneH * 0.12,
    );
    this.players.forEach((p, i) => {
      const y = top + i * laneH;
      g.fillStyle(i % 2 === 0 ? 0x3b4a63 : 0x33425a, 1);
      g.fillRect(rect.x + rect.w * 0.015, y, rect.w * 0.97, laneH);
      // lane marker: colour, symbol and number (never colour alone)
      const { cx, r } = geo.badge;
      const cy = y + laneH / 2;
      g.fillStyle(hexToNumber(p.style.color), 1);
      g.fillCircle(cx, cy, r);
      drawSymbol(g, p.style.symbol, cx, cy, r * 0.64, '#ffffff');
      // step marks: exactly where the car's nose stops after each correct answer
      for (const x of geo.markXs) {
        g.lineStyle(Math.max(1, laneH * 0.015), 0xffffff, 0.22);
        g.lineBetween(x, cy - laneH * 0.14, x, cy + laneH * 0.14);
      }
    });
    // dashed lane dividers
    for (let i = 1; i < this.players.length; i++) {
      const y = top + i * laneH;
      for (let x = rect.x + rect.w * 0.02; x < rect.x + rect.w * 0.98; x += laneH * 0.5) {
        g.lineStyle(Math.max(1.5, laneH * 0.02), 0xffffff, 0.35);
        g.lineBetween(x, y, x + laneH * 0.25, y);
      }
    }
    // start line (dashed) and checkered finish
    for (let y = top; y < top + lanesH; y += laneH * 0.14) {
      g.lineStyle(Math.max(2, laneH * 0.03), 0xffffff, 0.9);
      g.lineBetween(startLineX, y, startLineX, y + laneH * 0.08);
    }
    const cell = laneH / 4;
    const rows = Math.ceil(lanesH / cell);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        g.fillStyle((row + col) % 2 === 0 ? 0x0f172a : 0xffffff, 1);
        g.fillRect(
          finishLineX + (col * checkerW) / 2,
          top + row * cell,
          checkerW / 2,
          Math.min(cell, top + lanesH - (top + row * cell)),
        );
      }
    }
    const labelSize = Math.max(11, Math.min(laneH * 0.22, 22));
    this.pool.text('start', this.t('race.startLine'), startLineX, top - laneH * 0.08, {
      size: labelSize,
      color: THEME.white,
      bold: true,
      ay: 1,
    });
    this.pool.text(
      'finish',
      this.t('race.finishLine'),
      finishLineX + checkerW / 2,
      top - laneH * 0.08,
      { size: labelSize, color: THEME.white, bold: true, ay: 1 },
    );

    // racers
    this.drawPuffs();
    this.players.forEach((p, i) => {
      const m = this.motion.get(p.id) ?? new CarMotion();
      const racer = this.racerGeometry(i, m.progress, geo);
      const { size } = racer;
      const pose = this.poseOf(m, size, racer.stepPx);
      const moving = !this.reducedMotion && m.moving;
      // Speed lines behind a car driving forward: short, white, fading with speed.
      if (moving && pose.speed > 0.6) {
        const len = size * 0.34 * Math.min(1, pose.speed / 4);
        g.lineStyle(Math.max(1.5, size * 0.025), 0xffffff, 0.4 * Math.min(1, pose.speed / 3));
        for (let k = -1; k <= 1; k++) {
          const ly = racer.baseY + k * size * 0.17;
          const lx = racer.x - size * (0.72 + 0.05 * (k + 1));
          g.lineBetween(lx, ly, lx - len, ly);
        }
      }
      const bob = moving
        ? Math.sin(this.clock * 0.03) * size * 0.04 * Math.min(1, Math.abs(pose.speed))
        : 0;
      const shake = m.wobble * size * 0.045;
      const winnerBounce =
        this.banner?.winnerId === p.id && !this.reducedMotion
          ? Math.abs(Math.sin(this.clock * 0.008)) * size * 0.18
          : 0;
      const x = racer.x + shake;
      const y = racer.baseY + bob - winnerBounce;
      if (this.reducedMotion && m.highlightMs > 0) {
        // Reduced motion: no movement, so a brief static ring shows that this racer's position changed.
        g.lineStyle(Math.max(3, size * 0.06), 0xfde68a, Math.min(1, m.highlightMs / 200));
        g.strokeCircle(x, y, size * 0.62);
      }
      this.drawRacer(p.style, x, y, size, pose);
      // the name chip sits just above the vehicle and stays inside its own lane
      this.pool.text(`name:${p.id}`, p.name, x, y - size * 0.36, {
        size: Math.max(11, Math.min(laneH * 0.2, 24)),
        color: THEME.white,
        bold: true,
        bg: `#${p.style.dark.replace('#', '')}`,
        pad: Math.max(4, laneH * 0.08),
        ay: 1,
        maxWidth: Math.max(60, rect.w * 0.16),
        minSize: 10,
      });
    });

    if (this.countdown) {
      // Card width follows the text ("Mula!" is the widest label) and the font is capped by both the track
      // height and width, so the label fits any window shape (tall/narrow windows included).
      const cardW = Math.min(rect.w * 0.4, rect.h * 1.5);
      const cardH = rect.h * 0.76;
      g.fillStyle(0x0b1d3a, 0.55);
      g.fillRoundedRect(
        rect.x + (rect.w - cardW) / 2,
        rect.y + rect.h * 0.12,
        cardW,
        cardH,
        rect.h * 0.08,
      );
      this.pool.text('countdown', this.countdown, rect.x + rect.w / 2, rect.y + rect.h / 2, {
        size: Math.min(rect.h * 0.5, cardW * 0.42),
        color: THEME.white,
        bold: true,
        maxWidth: cardW * 0.92,
        minSize: 20,
      });
    }

    if (this.banner) this.drawBanner();
    this.pool.end();
  }

  private drawBanner(): void {
    const { g, rect } = this;
    const b = this.banner;
    if (!b) return;
    for (const c of this.confetti) {
      g.fillStyle(c.color, 1);
      const w = c.size;
      const h = c.size * (0.5 + 0.5 * Math.abs(Math.sin(c.spin)));
      g.fillRect(c.x - w / 2, c.y - h / 2, w, h);
    }
    const bw = rect.w * 0.56;
    const bh = rect.h * 0.34;
    const bx = rect.x + (rect.w - bw) / 2;
    const by = rect.y + (rect.h - bh) / 2;
    g.fillStyle(0xffffff, 0.96);
    g.fillRoundedRect(bx, by, bw, bh, bh * 0.2);
    g.lineStyle(Math.max(3, bh * 0.04), 0xf59e0b, 1);
    g.strokeRoundedRect(bx, by, bw, bh, bh * 0.2);
    const winner = this.players.find((p) => p.id === b.winnerId);
    if (winner) {
      const r = bh * 0.24;
      g.fillStyle(hexToNumber(winner.style.color), 1);
      g.fillCircle(bx + bh * 0.42, by + bh / 2, r * 1.3);
      drawSymbol(g, winner.style.symbol, bx + bh * 0.42, by + bh / 2, r, '#ffffff');
    }
    const textX = bx + (winner ? bh * 0.85 : 0) + (bw - (winner ? bh * 0.85 : 0)) / 2;
    const textW = bw - (winner ? bh * 0.85 : 0) - bh * 0.2;
    this.pool.text('bannertitle', b.text, textX, by + bh * (b.sub ? 0.4 : 0.5), {
      size: bh * 0.34,
      color: '#14532d',
      bold: true,
      maxWidth: textW,
      maxHeight: bh * 0.5,
      minSize: 14,
    });
    if (b.sub) {
      this.pool.text('bannersub', b.sub, textX, by + bh * 0.76, {
        size: bh * 0.16,
        color: THEME.muted,
        bold: true,
        maxWidth: textW,
        minSize: 10,
      });
    }
  }

  private drawRacer(style: PlayerStyle, x: number, y: number, size: number, pose: Pose): void {
    const { g } = this;
    const u = size / 2;
    const cosL = Math.cos(pose.lean);
    const sinL = Math.sin(pose.lean);
    const body = hexToNumber(style.color);
    const dark = hexToNumber(style.dark);
    const light = lighten(style.color, 0.55);
    // ground shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(x, y + u * 0.62, u * 1.9, u * 0.28);
    // Vehicle-space point -> screen, tilted by the lean (nose up while accelerating, nose down when braking).
    const P = (px: number, py: number): { x: number; y: number } => ({
      x: x + (px * cosL - py * sinL) * u,
      y: y + (px * sinL + py * cosL) * u,
    });
    const poly = (pts: Array<[number, number]>, fill: number, stroke = dark): void => {
      const first = pts[0];
      if (!first) return;
      g.fillStyle(fill, 1);
      g.beginPath();
      g.moveTo(P(first[0], first[1]).x, P(first[0], first[1]).y);
      for (const [px, py] of pts.slice(1)) g.lineTo(P(px, py).x, P(px, py).y);
      g.closePath();
      g.fillPath();
      g.lineStyle(Math.max(1.5, u * 0.07), stroke, 1);
      g.strokePath();
    };
    const wheel = (px: number, py: number, r = 0.26): void => {
      g.fillStyle(0x111827, 1);
      g.fillCircle(P(px, py).x, P(px, py).y, u * r);
      // Spokes turn with the distance rolled, so the wheels visibly roll forward or backward.
      const c = P(px, py);
      g.lineStyle(Math.max(1.2, u * r * 0.16), 0xe5e7eb, 1);
      for (let k = 0; k < 3; k++) {
        const a = pose.wheelAngle + (k * Math.PI * 2) / 3;
        g.lineBetween(c.x, c.y, c.x + Math.cos(a) * u * r * 0.86, c.y + Math.sin(a) * u * r * 0.86);
      }
      g.fillStyle(0xe5e7eb, 1);
      g.fillCircle(c.x, c.y, u * r * 0.42);
    };
    const drawBadge = (px: number, py: number): void => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(P(px, py).x, P(px, py).y, u * 0.27);
      drawSymbol(g, style.symbol, P(px, py).x, P(px, py).y, u * 0.19, style.color);
    };
    const vehicle: VehicleId = style.vehicle;
    switch (vehicle) {
      case 'rocket':
        if (pose.direction === 'forward') {
          // The flame grows with speed, so a burst of speed on a correct answer is visible.
          const f = 0.2 + Math.min(0.4, pose.speed * 0.1) + 0.1 * Math.sin(this.clock * 0.04);
          poly(
            [
              [-0.9, -0.16],
              [-0.9 - f * 1.6, 0],
              [-0.9, 0.16],
            ],
            0xfb923c,
            0xea580c,
          );
        }
        poly(
          [
            [-0.55, -0.4],
            [-1.0, -0.9],
            [-0.85, -0.38],
          ],
          dark,
        );
        poly(
          [
            [-0.55, 0.4],
            [-1.0, 0.9],
            [-0.85, 0.38],
          ],
          dark,
        );
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
        );
        g.fillStyle(0xbae6fd, 1);
        g.fillCircle(P(0.5, 0).x, P(0.5, 0).y, u * 0.2);
        drawBadge(-0.15, 0);
        break;
      case 'kart':
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
        );
        g.fillStyle(0xfde68a, 1);
        g.fillCircle(P(0.05, -0.32).x, P(0.05, -0.32).y, u * 0.24);
        poly(
          [
            [0.55, -0.12],
            [0.85, 0.02],
            [0.55, 0.02],
          ],
          light,
        );
        wheel(-0.5, 0.42);
        wheel(0.55, 0.42);
        drawBadge(-0.3, 0.14);
        break;
      case 'wedge':
        poly(
          [
            [1.0, 0.42],
            [-0.95, 0.42],
            [-0.95, -0.28],
            [0.1, -0.28],
          ],
          body,
        );
        poly(
          [
            [0.15, -0.2],
            [0.75, 0.16],
            [0.15, 0.16],
          ],
          light,
        );
        wheel(-0.55, 0.44);
        wheel(0.55, 0.44);
        drawBadge(-0.5, 0.08);
        break;
      case 'saucer':
        g.fillStyle(0xbae6fd, 1);
        g.fillCircle(P(0.05, -0.18).x, P(0.05, -0.18).y, u * 0.46);
        g.lineStyle(Math.max(1.5, u * 0.07), dark, 1);
        g.strokeCircle(P(0.05, -0.18).x, P(0.05, -0.18).y, u * 0.46);
        g.fillStyle(body, 1);
        g.fillEllipse(P(0, 0.12).x, P(0, 0.12).y, u * 2.0, u * 0.62);
        g.strokeEllipse(P(0, 0.12).x, P(0, 0.12).y, u * 2.0, u * 0.62);
        for (const lx of [-0.65, 0, 0.65]) {
          g.fillStyle(0xfde68a, 1);
          g.fillCircle(P(lx, 0.16).x, P(lx, 0.16).y, u * 0.09);
        }
        drawBadge(0.05, -0.18);
        break;
      case 'block':
        poly(
          [
            [-0.95, -0.4],
            [0.25, -0.4],
            [0.25, 0.42],
            [-0.95, 0.42],
          ],
          body,
        );
        poly(
          [
            [0.25, -0.12],
            [0.75, -0.12],
            [1.0, 0.12],
            [1.0, 0.42],
            [0.25, 0.42],
          ],
          lighten(style.color, 0.25) as number,
        );
        poly(
          [
            [0.42, -0.02],
            [0.72, -0.02],
            [0.86, 0.14],
            [0.42, 0.14],
          ],
          0xbae6fd,
        );
        wheel(-0.55, 0.44);
        wheel(0.62, 0.44);
        drawBadge(-0.35, 0);
        break;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.pool.destroy();
    this.g.destroy();
  }
}
