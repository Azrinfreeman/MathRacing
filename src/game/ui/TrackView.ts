import type * as Phaser from 'phaser';
import type { Translator } from '../../locales';
import type { SpeedState } from '../core/cruise';
import { PLAYER_STYLES } from '../core/players';
import type { PlayerStyle } from '../core/players';
import type { RacerId } from '../core/racers';
import { TextPool } from './DrawContext';
import type { Rect } from './geometry';
import { CarMotion } from './motion';
import {
  OUTLINE_WIDTH,
  STILL_POSE,
  gaitPhase,
  partsBounds,
  racerKind,
  racerParts,
} from './racerShapes';
import type { Pose } from './racerShapes';
import { drawSymbol } from './shapes';
import { computeTrackGeometry } from './trackGeometry';
import type { TrackGeometry } from './trackGeometry';
import { THEME, hexToNumber, lighten } from './theme';

export type TrackPlayer = { id: string; name: string; style: PlayerStyle; racer: RacerId };

/**
 * How far above the racer's centre the name chip sits, as a share of the racer size. Vehicles keep the original
 * height; a tall animal (the goose's head, the rabbit's ears) lifts the chip so it does not hide the head.
 */
const nameLiftCache = new Map<RacerId, number>();
function nameLift(racer: RacerId): number {
  let lift = nameLiftCache.get(racer);
  if (lift === undefined) {
    const top = partsBounds(racerParts(racer, PLAYER_STYLES[0] as PlayerStyle, STILL_POSE)).minY;
    lift = racerKind(racer) === 'animal' ? Math.max(0.36, (0 - top) / 2 + 0.02) : 0.36;
    nameLiftCache.set(racer, lift);
  }
  return lift;
}

/** Nose-down tilt while slowed, so a slow-down reads as braking. */
const SLOW_LEAN = 0.05;

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

  /** Cruise: place a racer at the engine's distance every frame, with its speed state for the effects. */
  setDistance(playerId: string, distance: number, speedState: SpeedState): void {
    this.motion.get(playerId)?.follow(distance, speedState, this.reducedMotion);
  }

  /** Reduced motion: a brief static ring when a racer's speed changes (boost or slow-down). */
  flash(playerId: string): void {
    this.motion.get(playerId)?.flash(this.reducedMotion);
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
    const lean =
      Math.max(-LEAN_LIMIT, Math.min(LEAN_LIMIT, -m.accel / 1200)) +
      m.wobble * 0.06 +
      (m.speedState === 'slow' ? SLOW_LEAN : 0);
    const wheelRadius = (size / 2) * 0.26;
    return {
      direction: m.direction,
      speedState: m.speedState,
      speed: m.velocity,
      lean,
      wheelAngle: (m.travelled * stepPx) / wheelRadius,
      gait: gaitPhase(m.travelled * stepPx, size),
      clock: this.clock,
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

  /**
   * Exhaust behind a car driving forward (a steady stream while boosting); neutral dust at the front bumper
   * while it rolls back, and under the rear wheel while it is slowed. A plain cruise makes no puffs.
   */
  private emitPuffs(id: string, index: number, m: CarMotion, dtMs: number): void {
    const speed = Math.abs(m.velocity);
    if (dtMs <= 0) return;
    if (m.speedState === 'slow') {
      this.emitSlowDust(id, index, m, dtMs);
      return;
    }
    const boosting = m.speedState === 'boost';
    if (!boosting && (!m.moving || speed < 0.15)) return;
    const forward = m.velocity > 0;
    const rate = boosting
      ? 18
      : forward
        ? 22 * Math.min(1, speed / 3)
        : 12 * Math.min(1, speed / 1.5);
    let acc = (this.emitAcc.get(id) ?? 0) + (rate * dtMs) / 1000;
    const { x, baseY, size } = this.racerGeometry(index, m.progress);
    // Animals kick up dust at their feet; only vehicles leave exhaust.
    const racer = this.players[index]?.racer;
    const animal = racer !== undefined && racerKind(racer) === 'animal';
    while (acc >= 1) {
      acc -= 1;
      const jitter = (Math.random() - 0.5) * size * 0.12;
      if (forward) {
        this.spawnPuff({
          x: x - size * 0.5,
          y: baseY + size * (animal ? 0.3 : 0.22) + jitter,
          vx: -size * 0.0006,
          vy: -size * 0.0002,
          size: size * 0.07,
          grow: size * 0.00018,
          life: 420,
          color: animal ? DUST_COLOR : TRAIL_COLOR,
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

  private emitSlowDust(id: string, index: number, m: CarMotion, dtMs: number): void {
    let acc = (this.emitAcc.get(id) ?? 0) + (8 * dtMs) / 1000;
    const { x, baseY, size } = this.racerGeometry(index, m.progress);
    while (acc >= 1) {
      acc -= 1;
      this.spawnPuff({
        x: x - size * 0.35 + (Math.random() - 0.5) * size * 0.1,
        y: baseY + size * 0.3,
        vx: -size * 0.0002,
        vy: -size * 0.00012,
        size: size * 0.05,
        grow: size * 0.00012,
        life: 480,
        color: DUST_COLOR,
        alpha: 0.45,
      });
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
      // Speed lines behind a car driving forward (always while boosting): short, white, fading with speed.
      if (moving && (pose.speed > 0.6 || pose.speedState === 'boost')) {
        const strength = Math.max(pose.speedState === 'boost' ? 0.6 : 0, pose.speed / 3);
        const len = size * 0.34 * Math.min(1, strength * 0.75);
        g.lineStyle(Math.max(1.5, size * 0.025), 0xffffff, 0.4 * Math.min(1, strength));
        for (let k = -1; k <= 1; k++) {
          const ly = racer.baseY + k * size * 0.17;
          const lx = racer.x - size * (0.72 + 0.05 * (k + 1));
          g.lineBetween(lx, ly, lx - len, ly);
        }
      }
      // Animals bob with their own steps (racerParts); vehicles bounce gently on the road.
      const bob =
        moving && racerKind(p.racer) === 'vehicle'
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
      this.drawRacer(p.style, p.racer, x, y, size, pose);
      // the name chip sits just above the vehicle and stays inside its own lane
      this.pool.text(`name:${p.id}`, p.name, x, y - size * nameLift(p.racer), {
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

  private drawRacer(
    style: PlayerStyle,
    racer: RacerId,
    x: number,
    y: number,
    size: number,
    pose: Pose,
  ): void {
    const { g } = this;
    const u = size / 2;
    const cosL = Math.cos(pose.lean);
    const sinL = Math.sin(pose.lean);
    // ground shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(x, y + u * 0.62, u * 1.9, u * 0.28);
    // Racer-space point -> screen, tilted by the lean (nose up while accelerating, nose down when braking).
    const P = (px: number, py: number): { x: number; y: number } => ({
      x: x + (px * cosL - py * sinL) * u,
      y: y + (px * sinL + py * cosL) * u,
    });
    const outline = Math.max(1.5, u * OUTLINE_WIDTH);
    for (const part of racerParts(racer, style, pose)) {
      switch (part.kind) {
        case 'poly': {
          const first = part.pts[0];
          if (!first) break;
          g.fillStyle(hexToNumber(part.fill), 1);
          g.beginPath();
          const s0 = P(first[0], first[1]);
          g.moveTo(s0.x, s0.y);
          for (const [px, py] of part.pts.slice(1)) {
            const q = P(px, py);
            g.lineTo(q.x, q.y);
          }
          g.closePath();
          g.fillPath();
          if (part.stroke) {
            g.lineStyle(outline, hexToNumber(part.stroke), 1);
            g.strokePath();
          }
          break;
        }
        case 'circle': {
          const c = P(part.x, part.y);
          g.fillStyle(hexToNumber(part.fill), 1);
          g.fillCircle(c.x, c.y, u * part.r);
          if (part.stroke) {
            g.lineStyle(outline, hexToNumber(part.stroke), 1);
            g.strokeCircle(c.x, c.y, u * part.r);
          }
          break;
        }
        case 'ellipse': {
          const c = P(part.x, part.y);
          g.fillStyle(hexToNumber(part.fill), 1);
          g.fillEllipse(c.x, c.y, u * part.rx * 2, u * part.ry * 2);
          if (part.stroke) {
            g.lineStyle(outline, hexToNumber(part.stroke), 1);
            g.strokeEllipse(c.x, c.y, u * part.rx * 2, u * part.ry * 2);
          }
          break;
        }
        case 'line': {
          const a = P(part.x1, part.y1);
          const b = P(part.x2, part.y2);
          g.lineStyle(Math.max(1.2, u * part.width), hexToNumber(part.color), 1);
          g.lineBetween(a.x, a.y, b.x, b.y);
          break;
        }
        case 'badge': {
          const c = P(part.x, part.y);
          g.fillStyle(0xffffff, 1);
          g.fillCircle(c.x, c.y, u * part.r);
          drawSymbol(g, style.symbol, c.x, c.y, u * part.r * 0.7, style.color);
          break;
        }
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.pool.destroy();
    this.g.destroy();
  }
}
