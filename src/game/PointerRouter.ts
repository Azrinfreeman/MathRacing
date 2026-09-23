import type { InputOwnership, PanelId } from './core/InputOwnership';

/** The bits of a Phaser pointer the router needs (and what tests fake). */
export type PointerLike = {
  id: number;
  x: number;
  y: number;
  /** Native DOM event; its high-resolution timeStamp preserves true order of near-simultaneous touches. */
  event?: { timeStamp?: number } | undefined;
};

/** The subset of Phaser's InputPlugin the router subscribes to. */
export interface PointerEventSource {
  on(event: string, listener: (pointer: PointerLike) => void): unknown;
  off(event: string, listener: (pointer: PointerLike) => void): unknown;
}

export type RouterHandlers = {
  /** Which player panel contains a point, or null when it is outside every panel. */
  hitPanel(x: number, y: number): PanelId | null;
  press(panel: PanelId, pointer: PointerLike): void;
  /** `inside` is false when the pointer was released outside its owner panel (slid out). */
  release(panel: PanelId, pointer: PointerLike, inside: boolean): void;
  cancel(panel: PanelId, pointerId: number): void;
};

/**
 * Adapter between Phaser's pointer events and the pure InputOwnership rules. It is the only place that
 * turns pointer events into panel intents, and it guarantees that a pointer only ever acts on the panel it
 * started in.
 */
export class PointerRouter {
  private attached = false;

  constructor(
    private readonly source: PointerEventSource,
    private readonly ownership: InputOwnership,
    private readonly handlers: RouterHandlers,
  ) {}

  private readonly onDown = (pointer: PointerLike): void => {
    const panel = this.handlers.hitPanel(pointer.x, pointer.y);
    const result = this.ownership.down(pointer.id, panel);
    if (result.replacedOwner !== undefined) this.handlers.cancel(result.replacedOwner, pointer.id); // a stale press whose "up" was missed
    if (panel !== null) this.handlers.press(panel, pointer);
  };

  private readonly onUp = (pointer: PointerLike): void => {
    const panelAtRelease = this.handlers.hitPanel(pointer.x, pointer.y);
    const result = this.ownership.up(pointer.id, panelAtRelease);
    if (result) this.handlers.release(result.owner, pointer, result.inside);
  };

  private readonly onUpOutside = (pointer: PointerLike): void => {
    const result = this.ownership.up(pointer.id, null);
    if (result) this.handlers.release(result.owner, pointer, false);
  };

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.source.on('pointerdown', this.onDown);
    this.source.on('pointerup', this.onUp);
    this.source.on('pointerupoutside', this.onUpOutside);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.source.off('pointerdown', this.onDown);
    this.source.off('pointerup', this.onUp);
    this.source.off('pointerupoutside', this.onUpOutside);
  }

  /** Drop one pointer (touch cancelled). */
  cancelPointer(pointerId: number): void {
    const owner = this.ownership.cancel(pointerId);
    if (owner !== undefined) this.handlers.cancel(owner, pointerId);
  }

  /** Drop every pointer: pause, visibility change, race finish, scene shutdown. */
  releaseAll(): void {
    for (const { pointerId, owner } of this.ownership.releaseAll())
      this.handlers.cancel(owner, pointerId);
  }

  /**
   * Safety net for a missed pointer-up: release any owned pointer that the platform says is no longer down.
   * Call it every frame or two from the scene's update.
   */
  reconcile(isDown: (pointerId: number) => boolean): void {
    for (const { pointerId } of this.ownership.snapshot()) {
      if (!isDown(pointerId)) this.cancelPointer(pointerId);
    }
  }
}
