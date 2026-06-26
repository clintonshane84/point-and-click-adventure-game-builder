/**
 * Grid-based A* pathfinding with string-pulling (Simple Stupid Funnel Algorithm).
 *
 * Phase 1 — A*: finds the optimal sequence of grid cells from start to end,
 *   respecting 8-directional movement and Minkowski-inflated obstacle padding.
 *
 * Phase 2 — String-pull (SSFA): converts consecutive cell pairs into "portals"
 *   (the shared edge between adjacent walkable cells), then sweeps through the
 *   portal sequence maintaining a funnel cone. Whenever a portal boundary forces
 *   a turn, the tightest corner vertex is emitted as a waypoint. The result is
 *   the geometrically shortest path through the navigable corridor — a strict
 *   improvement over greedy line-of-sight smoothing.
 */

export const GRID_CELL = 16  // scene px per grid cell

export interface PathPoint { x: number; y: number }

interface ANode {
  g: number; h: number; f: number
  row: number; col: number
  parent: ANode | null
}

interface Portal { lx: number; ly: number; rx: number; ry: number }

// 2D signed cross product of (O→A) × (O→B) in screen coordinates (y-down).
//   > 0  →  B is to the right of ray O→A  (clockwise in screen space)
//   < 0  →  B is to the left  of ray O→A  (counter-clockwise in screen space)
//   = 0  →  collinear
function cross2D(
  ox: number, oy: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox)
}

// Build a portal for each step in the A* cell path.
// The portal is the shared edge between consecutive cells, oriented so that
// L (left) and R (right) are consistent with the direction of travel —
// i.e. cross2D(prevCentre, L, R) > 0 for all portals.
// Diagonal moves produce a degenerate portal (L === R = shared corner vertex).
// The final element is always a degenerate portal at the exact destination.
function buildPortals(cells: ANode[], endX: number, endY: number): Portal[] {
  const G = GRID_CELL
  const portals: Portal[] = []

  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1], b = cells[i]
    const dc = b.col - a.col, dr = b.row - a.row
    let lx: number, ly: number, rx: number, ry: number

    if (dc === 1 && dr === 0) {          // moving right
      lx = b.col * G;  ly = a.row * G
      rx = b.col * G;  ry = (a.row + 1) * G
    } else if (dc === -1 && dr === 0) {  // moving left
      lx = a.col * G;  ly = (a.row + 1) * G
      rx = a.col * G;  ry = a.row * G
    } else if (dc === 0 && dr === 1) {   // moving down
      lx = (a.col + 1) * G;  ly = b.row * G
      rx = a.col * G;         ry = b.row * G
    } else if (dc === 0 && dr === -1) {  // moving up
      lx = a.col * G;         ly = a.row * G
      rx = (a.col + 1) * G;  ry = a.row * G
    } else {                              // diagonal — shared corner vertex
      lx = rx = Math.max(a.col, b.col) * G
      ly = ry = Math.max(a.row, b.row) * G
    }

    portals.push({ lx, ly, rx, ry })
  }

  // Final degenerate portal: the exact click/destination point
  portals.push({ lx: endX, ly: endY, rx: endX, ry: endY })
  return portals
}

// Simple Stupid Funnel Algorithm (SSFA).
// Sweeps the portal sequence once, maintaining a left/right funnel cone from
// the current apex. When a portal boundary forces the cone to cross itself, the
// constraining corner becomes the next waypoint and the scan restarts from there.
// Runs in O(n) time (each portal is processed at most twice across all restarts).
function stringPull(
  startX: number, startY: number,
  portals: Portal[],
): PathPoint[] {
  if (portals.length === 0) return [{ x: startX, y: startY }]

  const result: PathPoint[] = [{ x: startX, y: startY }]

  // Apex = last confirmed waypoint.  fL/fR = current funnel boundary points.
  let ax = startX, ay = startY
  let flx = startX, fly = startY   // funnel left boundary
  let frx = startX, fry = startY   // funnel right boundary
  let iL = 0, iR = 0               // portal indices where fL / fR were last set

  for (let i = 0; i < portals.length; i++) {
    const { lx, ly, rx, ry } = portals[i]

    // ── Right boundary update ─────────────────────────────────────────────────
    // A new R tightens the funnel when it is to the LEFT of (apex→fR), i.e.
    // inside the funnel from the right-boundary perspective.
    if (cross2D(ax, ay, frx, fry, rx, ry) <= 0) {
      const sameApexR = (ax === frx && ay === fry)
      if (sameApexR || cross2D(ax, ay, flx, fly, rx, ry) >= 0) {
        // R is still on the right side of the left boundary — tighten
        frx = rx; fry = ry; iR = i
      } else {
        // R crossed the left boundary → fL is the next waypoint; restart from iL
        result.push({ x: flx, y: fly })
        ax = flx; ay = fly
        const restart = iL + 1
        flx = ax; fly = ay; frx = ax; fry = ay
        iL = restart; iR = restart
        i = restart - 1   // loop i++ → i = restart
        continue
      }
    }

    // ── Left boundary update ──────────────────────────────────────────────────
    // A new L tightens the funnel when it is to the RIGHT of (apex→fL).
    if (cross2D(ax, ay, flx, fly, lx, ly) >= 0) {
      const sameApexL = (ax === flx && ay === fly)
      if (sameApexL || cross2D(ax, ay, frx, fry, lx, ly) <= 0) {
        // L is still on the left side of the right boundary — tighten
        flx = lx; fly = ly; iL = i
      } else {
        // L crossed the right boundary → fR is the next waypoint; restart from iR
        result.push({ x: frx, y: fry })
        ax = frx; ay = fry
        const restart = iR + 1
        flx = ax; fly = ay; frx = ax; fry = ay
        iL = restart; iR = restart
        i = restart - 1
        continue
      }
    }
  }

  // Add the destination (last portal's point) if not already there
  const end = portals[portals.length - 1]
  const last = result[result.length - 1]
  if (last.x !== end.lx || last.y !== end.ly) {
    result.push({ x: end.lx, y: end.ly })
  }
  return result
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

  // Inflate obstacles by half character size (Minkowski sum) so the centre
  // of the character never gets closer to a wall than its own half-width/height.
  const padX = Math.max(0, charWidth / 2 - 1)
  const padY = Math.max(0, charHeight / 2 - 1)

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

  // If target cell is blocked, find furthest walkable cell along start→target line
  let effectiveToX = toX, effectiveToY = toY
  if (!walkable[endRow][endCol]) {
    const dr = endRow - startRow, dc = endCol - startCol
    const steps = Math.max(Math.abs(dr), Math.abs(dc), 1)
    let found = false
    for (let step = steps; step >= 1; step--) {
      const r = Math.round(startRow + dr * (step / steps))
      const c = Math.round(startCol + dc * (step / steps))
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue
      if (walkable[r][c]) {
        endRow = r; endCol = c; found = true
        effectiveToX = c * GRID_CELL + GRID_CELL / 2
        effectiveToY = r * GRID_CELL + GRID_CELL / 2
        break
      }
    }
    if (!found) {
      // Nothing walkable along the line — fall back to nearest walkable anywhere
      let best = Infinity
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!walkable[r][c]) continue
          const d = (r - endRow) ** 2 + (c - endCol) ** 2
          if (d < best) { best = d; endRow = r; endCol = c }
        }
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
  const allNodes = new Map<number, ANode>()  // every node ever enqueued (for fallback)

  const root: ANode = { g: 0, h: h(startRow, startCol), f: 0, row: startRow, col: startCol, parent: null }
  root.f = root.h
  open.set(key(startRow, startCol), root)
  allNodes.set(key(startRow, startCol), root)

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
      allNodes.set(nk, node)
    }
  }

  if (!endNode) {
    // No path to destination — find furthest reachable cell along start→destination line
    const dr = endRow - startRow, dc = endCol - startCol
    const steps = Math.max(Math.abs(dr), Math.abs(dc), 1)
    for (let step = steps; step >= 1; step--) {
      const r = Math.round(startRow + dr * (step / steps))
      const c = Math.round(startCol + dc * (step / steps))
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue
      if (!walkable[r][c]) continue
      if (r === startRow && c === startCol) break
      const n = allNodes.get(key(r, c))
      if (n && closed.has(key(r, c))) {
        endNode = n
        effectiveToX = c * GRID_CELL + GRID_CELL / 2
        effectiveToY = r * GRID_CELL + GRID_CELL / 2
        break
      }
    }
    if (!endNode) return []
  }

  // ── Reconstruct cell path ─────────────────────────────────────────────────
  const cells: ANode[] = []
  let n: ANode | null = endNode
  while (n) { cells.unshift(n); n = n.parent }

  // ── Build portals + string-pull ───────────────────────────────────────────
  const portals = buildPortals(cells, effectiveToX, effectiveToY)
  return stringPull(fromX, fromY, portals)
}
