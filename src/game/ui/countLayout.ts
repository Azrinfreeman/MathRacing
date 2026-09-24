import type { Rect } from './geometry';

/**
 * Pure layout for counting pictures (DECISIONS #42): where each cell of a ten-frame, each block of a base-ten set
 * and each object of an equal group goes. No Phaser, so tests can check that every picture stays countable on a
 * small 5-player panel.
 */

/** Cells in reading order: frames of 2 rows x 5 columns, frames laid out in the grid that makes cells largest. */
export function tenFrameCells(
  count: number,
  area: Rect,
): { cells: Array<{ x: number; y: number }>; cell: number; frames: Rect[] } {
  const frameCount = Math.max(1, Math.ceil(count / 10));
  let best = { cols: frameCount, rows: 1, cell: 0 };
  for (let cols = 1; cols <= frameCount; cols++) {
    const rows = Math.ceil(frameCount / cols);
    // a frame is 5 cells wide and 2 high, with a gap of half a cell between frames
    const cell = Math.min(
      area.w / (cols * 5 + (cols - 1) * 0.5),
      area.h / (rows * 2 + (rows - 1) * 0.5),
    );
    if (cell > best.cell) best = { cols, rows, cell };
  }
  const { cols, rows, cell } = best;
  const gridW = cols * 5 * cell + (cols - 1) * 0.5 * cell;
  const gridH = rows * 2 * cell + (rows - 1) * 0.5 * cell;
  const x0 = area.x + (area.w - gridW) / 2;
  const y0 = area.y + (area.h - gridH) / 2;
  const frames: Rect[] = [];
  for (let f = 0; f < frameCount; f++) {
    const fx = x0 + (f % cols) * 5.5 * cell;
    const fy = y0 + Math.floor(f / cols) * 2.5 * cell;
    frames.push({ x: fx, y: fy, w: 5 * cell, h: 2 * cell });
  }
  const cells: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const frame = frames[Math.floor(i / 10)] as Rect;
    const k = i % 10;
    cells.push({
      x: frame.x + (k % 5) * cell + cell / 2,
      y: frame.y + Math.floor(k / 5) * cell + cell / 2,
    });
  }
  return { cells, cell, frames };
}

export type BlockKind = 'hundred' | 'ten' | 'one';
export type PlacedBlock = { kind: BlockKind; rect: Rect };

/**
 * Base-ten blocks: flats, then rods, then single cubes in columns of 5, each kind wrapped into 1-3 bands so the
 * blocks stay as large as possible (999 is 9 + 9 + 9 blocks). `unit` is the width of a rod; a rod is 5 units tall
 * and marked in 10 segments, a flat is 5 x 5 units marked 10 x 10, and a single cube is 0.9 unit so it is easy to
 * count. Blocks are listed kind by kind in reading order (crossed-out blocks are the last of each kind).
 */
export function blockLayout(
  set: { hundreds: number; tens: number; ones: number },
  area: Rect,
): { blocks: PlacedBlock[]; unit: number } {
  const BAND = 5;
  const BAND_GAP = 0.8;
  const KIND_GAP = 1.4;
  const plan = (bands: number) => {
    const flatCols = Math.ceil(set.hundreds / bands);
    const rodCols = Math.ceil(set.tens / bands);
    const oneCols = Math.ceil(Math.ceil(set.ones / 5) / bands);
    const parts = [
      flatCols > 0 ? flatCols * 5 + (flatCols - 1) * 0.6 : 0,
      rodCols > 0 ? rodCols + (rodCols - 1) * 0.6 : 0,
      oneCols > 0 ? oneCols + (oneCols - 1) * 0.4 : 0,
    ];
    const used = parts.filter((w) => w > 0);
    const width = used.reduce((n, w) => n + w, 0) + Math.max(0, used.length - 1) * KIND_GAP;
    const height = bands * BAND + (bands - 1) * BAND_GAP;
    const unit = Math.min(area.w / Math.max(1, width), area.h / height);
    return { bands, flatCols, rodCols, oneCols, parts, width, height, unit };
  };
  let best = plan(1);
  for (const bands of [2, 3]) {
    const p = plan(bands);
    if (p.unit > best.unit + 1e-9) best = p;
  }
  const { unit, flatCols, rodCols, oneCols, parts, width, height } = best;
  const x0 = area.x + (area.w - width * unit) / 2;
  const y0 = area.y + (area.h - height * unit) / 2;
  const bandY = (band: number): number => y0 + band * (BAND + BAND_GAP) * unit;
  const blocks: PlacedBlock[] = [];
  let x = x0;
  for (let i = 0; i < set.hundreds; i++) {
    const col = i % flatCols;
    const band = Math.floor(i / flatCols);
    blocks.push({
      kind: 'hundred',
      rect: { x: x + col * 5.6 * unit, y: bandY(band), w: 5 * unit, h: 5 * unit },
    });
  }
  if (parts[0]) x += ((parts[0] as number) + KIND_GAP) * unit;
  for (let i = 0; i < set.tens; i++) {
    const col = i % rodCols;
    const band = Math.floor(i / rodCols);
    blocks.push({
      kind: 'ten',
      rect: { x: x + col * 1.6 * unit, y: bandY(band), w: unit, h: 5 * unit },
    });
  }
  if (parts[1]) x += ((parts[1] as number) + KIND_GAP) * unit;
  for (let i = 0; i < set.ones; i++) {
    const column = Math.floor(i / 5);
    const col = column % Math.max(1, oneCols);
    const band = Math.floor(column / Math.max(1, oneCols));
    const row = i % 5;
    blocks.push({
      kind: 'one',
      rect: {
        x: x + col * 1.4 * unit,
        y: bandY(band) + (4 - row) * unit,
        w: unit * 0.9,
        h: unit * 0.9,
      },
    });
  }
  return { blocks, unit };
}

/** Circled groups side by side (wrapping to rows), each holding its objects in a small grid. */
export function equalGroupLayout(
  groups: number,
  perGroup: number,
  area: Rect,
): { groups: Array<{ rect: Rect; cells: Array<{ x: number; y: number }> }>; cell: number } {
  const innerCols = perGroup <= 3 ? perGroup : perGroup <= 6 ? Math.ceil(perGroup / 2) : 5;
  const innerRows = Math.ceil(perGroup / innerCols);
  let best = { cols: groups, rows: 1, cell: 0 };
  for (let cols = 1; cols <= groups; cols++) {
    const rows = Math.ceil(groups / cols);
    // each group is its grid plus a margin of half a cell on every side, groups a quarter cell apart
    const cell = Math.min(
      area.w / (cols * (innerCols + 1) + (cols - 1) * 0.25),
      area.h / (rows * (innerRows + 1) + (rows - 1) * 0.25),
    );
    if (cell > best.cell) best = { cols, rows, cell };
  }
  const { cols, rows, cell } = best;
  const gw = (innerCols + 1) * cell;
  const gh = (innerRows + 1) * cell;
  const totalW = cols * gw + (cols - 1) * 0.25 * cell;
  const totalH = rows * gh + (rows - 1) * 0.25 * cell;
  const x0 = area.x + (area.w - totalW) / 2;
  const y0 = area.y + (area.h - totalH) / 2;
  const out: Array<{ rect: Rect; cells: Array<{ x: number; y: number }> }> = [];
  for (let g = 0; g < groups; g++) {
    const rect: Rect = {
      x: x0 + (g % cols) * (gw + 0.25 * cell),
      y: y0 + Math.floor(g / cols) * (gh + 0.25 * cell),
      w: gw,
      h: gh,
    };
    const cells: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < perGroup; i++) {
      cells.push({
        x: rect.x + cell * 0.5 + (i % innerCols) * cell + cell / 2,
        y: rect.y + cell * 0.5 + Math.floor(i / innerCols) * cell + cell / 2,
      });
    }
    out.push({ rect, cells });
  }
  return { groups: out, cell };
}
