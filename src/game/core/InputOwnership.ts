/**
 * Pointer ownership: the rule that makes five children on one touchscreen safe.
 *
 * On pointer-down the pointer id is bound to the player panel under that first contact. Until the pointer
 * is released or cancelled, it belongs to that panel only:
 *   - a pointer that starts outside every panel has no owner and can never act on a panel by sliding in;
 *   - a pointer that starts in panel A and is released over panel B still belongs to A (and is reported as
 *     "not inside"), so it can never press a control in B;
 *   - ownership is released on up, cancel, pause, visibility loss and race finish.
 *
 * This class is pure logic with no Phaser or DOM dependency, so it is unit-tested directly.
 */
export type PanelId = string;

export type PointerDownResult = {
  /** True when the pointer was bound to a panel. */
  bound: boolean;
  /** Panel of a stale binding for this pointer id (a pointer-up was missed) that was replaced. */
  replacedOwner?: PanelId;
};

export type PointerUpResult = {
  owner: PanelId;
  /** True when the release point is still inside the owner's panel. */
  inside: boolean;
};

export class InputOwnership {
  private readonly owners = new Map<number, PanelId>();

  /** Bind a pointer to the panel under its initial contact (or to nothing when outside all panels). */
  down(pointerId: number, panelUnderContact: PanelId | null): PointerDownResult {
    const previous = this.owners.get(pointerId);
    if (panelUnderContact === null) {
      this.owners.delete(pointerId);
      return previous === undefined ? { bound: false } : { bound: false, replacedOwner: previous };
    }
    this.owners.set(pointerId, panelUnderContact);
    return previous === undefined ? { bound: true } : { bound: true, replacedOwner: previous };
  }

  ownerOf(pointerId: number): PanelId | undefined {
    return this.owners.get(pointerId);
  }

  /**
   * Where should an event for this pointer go? Returns null when the pointer has no owner. While a
   * pointer moves, `inside` says whether it is still over its owner (used to drop press highlights).
   */
  route(pointerId: number, panelAtPoint: PanelId | null): PointerUpResult | null {
    const owner = this.owners.get(pointerId);
    if (owner === undefined) return null;
    return { owner, inside: panelAtPoint === owner };
  }

  /** End of a touch: release ownership and report whether it ended inside the owner's panel. */
  up(pointerId: number, panelAtRelease: PanelId | null): PointerUpResult | null {
    const result = this.route(pointerId, panelAtRelease);
    this.owners.delete(pointerId);
    return result;
  }

  /** Release a pointer without a position (pointercancel, lost capture). Returns its previous owner. */
  cancel(pointerId: number): PanelId | undefined {
    const owner = this.owners.get(pointerId);
    this.owners.delete(pointerId);
    return owner;
  }

  /** Release everything (pause, visibility change, race finish, scene shutdown). */
  releaseAll(): Array<{ pointerId: number; owner: PanelId }> {
    const released = [...this.owners.entries()].map(([pointerId, owner]) => ({ pointerId, owner }));
    this.owners.clear();
    return released;
  }

  /** Pointers currently owned by one panel (used to draw press highlights). */
  pointersOf(panel: PanelId): number[] {
    return [...this.owners.entries()].filter(([, owner]) => owner === panel).map(([id]) => id);
  }

  /** Current bindings, for the development diagnostic overlay. */
  snapshot(): ReadonlyArray<{ pointerId: number; owner: PanelId }> {
    return [...this.owners.entries()].map(([pointerId, owner]) => ({ pointerId, owner }));
  }

  get size(): number {
    return this.owners.size;
  }
}
