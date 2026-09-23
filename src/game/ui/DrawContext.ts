import type * as Phaser from 'phaser';
import { FONT_FAMILY } from './theme';

export type TextStyleLite = {
  size: number;
  color: string;
  bold?: boolean;
  /** Horizontal anchor 0 (left) .. 1 (right); default 0.5 (centred). */
  ax?: number;
  /** Vertical anchor 0 (top) .. 1 (bottom); default 0.5 (centred). */
  ay?: number;
  align?: 'left' | 'center' | 'right';
  alpha?: number;
  /** Wrap to this width. */
  maxWidth?: number;
  /** When set together with maxWidth, shrink the font until the wrapped text fits this height. */
  maxHeight?: number;
  minSize?: number;
  /** Filled background behind the text (used for name chips on the track). */
  bg?: string;
  /** Padding inside the background, in pixels. */
  pad?: number;
};

/** What visual/panel renderers draw with: one shared Graphics plus keyed, reusable text labels. */
export interface DrawContext {
  readonly g: Phaser.GameObjects.Graphics;
  text(key: string, value: string, x: number, y: number, style: TextStyleLite): void;
}

type Entry = { obj: Phaser.GameObjects.Text; signature: string; used: boolean };

/**
 * Pool of Phaser Text objects addressed by key. Redrawing a panel every frame would otherwise create and leak
 * Text objects; here each key reuses one object, only re-renders its canvas when content or style changes,
 * and hides labels that were not drawn in the current pass.
 */
export class TextPool {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  begin(): void {
    for (const e of this.entries.values()) e.used = false;
  }

  end(): void {
    for (const e of this.entries.values()) e.obj.setVisible(e.used);
  }

  text(key: string, value: string, x: number, y: number, style: TextStyleLite): void {
    let entry = this.entries.get(key);
    if (!entry) {
      const obj = this.scene.add.text(0, 0, '', { fontFamily: FONT_FAMILY });
      obj.setDepth(this.depth);
      entry = { obj, signature: '', used: true };
      this.entries.set(key, entry);
    }
    entry.used = true;
    const { obj } = entry;
    const signature = JSON.stringify([
      value,
      style.size,
      style.color,
      style.bold,
      style.align,
      style.maxWidth,
      style.maxHeight,
      style.minSize,
      style.bg,
      style.pad,
    ]);
    if (signature !== entry.signature) {
      entry.signature = signature;
      this.applyStyle(obj, value, style);
    }
    obj.setOrigin(style.ax ?? 0.5, style.ay ?? 0.5);
    obj.setPosition(Math.round(x), Math.round(y));
    obj.setAlpha(style.alpha ?? 1);
    obj.setVisible(true);
  }

  private applyStyle(obj: Phaser.GameObjects.Text, value: string, style: TextStyleLite): void {
    const setup = (size: number): void => {
      obj.setStyle({
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.max(6, Math.round(size))}px`,
        fontStyle: style.bold ? 'bold' : 'normal',
        color: style.color,
        align: style.align ?? 'center',
        lineSpacing: Math.round(size * 0.1),
        ...(style.bg ? { backgroundColor: style.bg } : { backgroundColor: undefined }),
        padding: style.bg
          ? {
              x: Math.round(style.pad ?? size * 0.35),
              y: Math.round((style.pad ?? size * 0.35) * 0.5),
            }
          : { x: 0, y: 0 },
      });
      // A width limit alone means "one line, shrink to fit" (names, labels, big numbers). Only text that
      // also has a height limit is allowed to wrap onto several lines (prompts, tile captions).
      obj.setWordWrapWidth(style.maxHeight !== undefined ? (style.maxWidth ?? null) : null, true);
      obj.setText(value);
    };
    // Phaser throws ("wordWrapWidth < a single character") when a wrap box is narrower than one glyph, which
    // can happen with very large text in an unusual window shape. That must never escape into the game loop
    // (it would freeze the whole screen), so shrink until the wrap succeeds and finally fall back to no wrap.
    const safeSetup = (target: number): number => {
      let attempt = target;
      for (let i = 0; i < 12; i++) {
        try {
          setup(attempt);
          return attempt;
        } catch {
          attempt = Math.max(6, attempt * 0.8);
        }
      }
      obj.setWordWrapWidth(null);
      obj.setText(value);
      return attempt;
    };
    let size = safeSetup(style.size);
    if (style.maxWidth !== undefined && style.maxHeight !== undefined) {
      const min = style.minSize ?? 9;
      let guard = 0;
      while (
        (obj.height > style.maxHeight || obj.width > style.maxWidth + 1) &&
        size > min &&
        guard < 24
      ) {
        size = safeSetup(Math.max(min, size * 0.9));
        guard++;
      }
    } else if (style.maxWidth !== undefined && obj.width > style.maxWidth + 1) {
      // single unbreakable word wider than the box: shrink to fit
      let guard = 0;
      while (obj.width > style.maxWidth + 1 && size > (style.minSize ?? 9) && guard < 24) {
        size = safeSetup(Math.max(style.minSize ?? 9, size * 0.9));
        guard++;
      }
    }
  }

  destroy(): void {
    for (const e of this.entries.values()) e.obj.destroy();
    this.entries.clear();
  }
}
