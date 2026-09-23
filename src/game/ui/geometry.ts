export type Rect = { x: number; y: number; w: number; h: number };

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function inset(r: Rect, dx: number, dy: number = dx): Rect {
  return { x: r.x + dx, y: r.y + dy, w: Math.max(0, r.w - 2 * dx), h: Math.max(0, r.h - 2 * dy) };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Split a rect into a grid of equal cells with a gap, row by row. */
export function gridCells(area: Rect, columns: number, rows: number, gap: number): Rect[] {
  if (columns < 1 || rows < 1) return [];
  const cellW = (area.w - gap * (columns - 1)) / columns;
  const cellH = (area.h - gap * (rows - 1)) / rows;
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      out.push({
        x: area.x + c * (cellW + gap),
        y: area.y + r * (cellH + gap),
        w: cellW,
        h: cellH,
      });
    }
  }
  return out;
}

/** Lay out `count` cells in `columns` columns (rows computed), centring an incomplete last row. */
export function flowCells(area: Rect, count: number, columns: number, gap: number): Rect[] {
  if (count < 1) return [];
  const cols = Math.min(columns, count);
  const rows = Math.ceil(count / cols);
  const cellW = (area.w - gap * (cols - 1)) / cols;
  const cellH = (area.h - gap * (rows - 1)) / rows;
  const out: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = r === rows - 1 ? count - r * cols : cols;
    const rowWidth = inRow * cellW + (inRow - 1) * gap;
    const startX = area.x + (area.w - rowWidth) / 2;
    out.push({ x: startX + c * (cellW + gap), y: area.y + r * (cellH + gap), w: cellW, h: cellH });
  }
  return out;
}
