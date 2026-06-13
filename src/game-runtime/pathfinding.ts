/**
 * Grid-based A* pathfinding with path smoothing.
 * Used by the game runtime to route the character around blocked zones.
 */

export const GRID_CELL = 16  // scene px per grid cell

export interface PathPoint { x: number; y: number }

interface ANode {
  g: number; h: number; f: number
  row: number; col: number
  parent: ANode | null
}

export function findPath(
  blockedZones: { x: number; y: number; width: number; height: number }[],
  sceneWidth: number,
  sceneHeight: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  charWidth = 0,
  charHeight = 0,
): PathPoint[] {
  const cols = Math.ceil(sceneWidth / GRID_CELL)
  const rows = Math.ceil(sceneHeight / GRID_CELL)

  // Inflate obstacles by half character size (Minkowski sum) so the center
  // of the character never gets closer to a wall than its own half-width/height.
  const padX = charWidth / 2
  const padY = charHeight / 2

  // Build walkability grid (true = walkable)
  const walkable: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(true))
  for (const z of blockedZones) {
    const c0 = Math.max(0, Math.floor((z.x - padX) / GRID_CELL))
    const c1 = Math.min(cols, Math.ceil((z.x + z.width + padX) / GRID_CELL))
    const r0 = Math.max(0, Math.floor((z.y - padY) / GRID_CELL))
    const r1 = Math.min(rows, Math.ceil((z.y + z.height + padY) / GRID_CELL))
    for (let r = r0; r < r1; r++)
      for (let c = c0; c < c1; c++)
        walkable[r][c] = false
  }

  const clampCol = (c: number) => Math.max(0, Math.min(cols - 1, c))
  const clampRow = (r: number) => Math.max(0, Math.min(rows - 1, r))

  const startCol = clampCol(Math.round(fromX / GRID_CELL))
  const startRow = clampRow(Math.round(fromY / GRID_CELL))
  let endCol = clampCol(Math.round(toX / GRID_CELL))
  let endRow = clampRow(Math.round(toY / GRID_CELL))

  // If start is blocked, clear it (character is already there)
  walkable[startRow][startCol] = true

  // If target cell is blocked, find nearest walkable neighbour
  if (!walkable[endRow][endCol]) {
    let best = Infinity
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!walkable[r][c]) continue
        const d = (r - endRow) ** 2 + (c - endCol) ** 2
        if (d < best) { best = d; endRow = r; endCol = c }
      }
    }
  }

  if (startRow === endRow && startCol === endCol) return [{ x: toX, y: toY }]

  // ── A* ────────────────────────────────────────────────────────────────────
  const key = (r: number, c: number) => r * cols + c
  const h = (r: number, c: number) =>
    Math.sqrt((r - endRow) ** 2 + (c - endCol) ** 2)

  const open = new Map<number, ANode>()
  const closed = new Set<number>()

  const root: ANode = { g: 0, h: h(startRow, startCol), f: 0, row: startRow, col: startCol, parent: null }
  root.f = root.h
  open.set(key(startRow, startCol), root)

  // 8-directional neighbours: 4 cardinal then 4 diagonal
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
  const SQRT2 = Math.SQRT2

  let endNode: ANode | null = null

  while (open.size > 0) {
    let current: ANode | null = null
    for (const node of open.values())
      if (!current || node.f < current.f) current = node
    if (!current) break

    if (current.row === endRow && current.col === endCol) { endNode = current; break }

    const ck = key(current.row, current.col)
    open.delete(ck)
    closed.add(ck)

    for (let i = 0; i < DIRS.length; i++) {
      const [dr, dc] = DIRS[i]
      const nr = current.row + dr, nc = current.col + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (!walkable[nr][nc]) continue
      if (closed.has(key(nr, nc))) continue
      // Block diagonal movement through corners
      if (dr !== 0 && dc !== 0) {
        if (!walkable[current.row + dr][current.col] || !walkable[current.row][current.col + dc]) continue
      }

      const g = current.g + (i < 4 ? 1 : SQRT2)
      const nk = key(nr, nc)
      const existing = open.get(nk)
      if (existing && existing.g <= g) continue

      const node: ANode = { g, h: h(nr, nc), f: 0, row: nr, col: nc, parent: current }
      node.f = node.g + node.h
      open.set(nk, node)
    }
  }

  if (!endNode) {
    return []
  }

  // ── Reconstruct ───────────────────────────────────────────────────────────
  const raw: PathPoint[] = []
  let n: ANode | null = endNode
  while (n) {
    raw.unshift({ x: n.col * GRID_CELL + GRID_CELL / 2, y: n.row * GRID_CELL + GRID_CELL / 2 })
    n = n.parent
  }
  // Replace last point with the exact click target
  if (raw.length > 0) raw[raw.length - 1] = { x: toX, y: toY }

  return smoothPath(raw, walkable, rows, cols)
}

// ── Path smoothing (skip intermediate waypoints in line-of-sight) ─────────────

function smoothPath(
  path: PathPoint[],
  walkable: boolean[][],
  rows: number,
  cols: number,
): PathPoint[] {
  if (path.length <= 2) return path
  const result: PathPoint[] = [path[0]]
  let i = 0
  while (i < path.length - 1) {
    let j = path.length - 1
    while (j > i + 1 && !lineOfSight(path[i], path[j], walkable, rows, cols)) j--
    result.push(path[j])
    i = j
  }
  return result
}

function lineOfSight(
  a: PathPoint, b: PathPoint,
  walkable: boolean[][], rows: number, cols: number,
): boolean {
  let c0 = Math.floor(a.x / GRID_CELL), r0 = Math.floor(a.y / GRID_CELL)
  const c1 = Math.floor(b.x / GRID_CELL), r1 = Math.floor(b.y / GRID_CELL)
  const dc = Math.abs(c1 - c0), dr = Math.abs(r1 - r0)
  const sc = c0 < c1 ? 1 : -1, sr = r0 < r1 ? 1 : -1
  let err = dc - dr
  for (;;) {
    if (r0 < 0 || r0 >= rows || c0 < 0 || c0 >= cols) return false
    if (!walkable[r0][c0]) return false
    if (c0 === c1 && r0 === r1) return true
    const e2 = 2 * err
    if (e2 > -dr) { err -= dr; c0 += sc }
    if (e2 < dc)  { err += dc; r0 += sr }
  }
}
