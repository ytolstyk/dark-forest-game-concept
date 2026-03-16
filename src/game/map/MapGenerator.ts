import { TileType } from '../types';
import type { Vector2 } from '../types';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../constants';
import { createNoiseGenerator } from '../utils/noise';
import { randomInt, distance } from '../utils/math';

export interface MapData {
  tiles: TileType[][];
  playerSpawn: Vector2;
  carPosition: Vector2;
  keysPosition: Vector2;
  fuelPosition: Vector2;
  enemySpawns: Vector2[];
}

export function generateMap(): MapData {
  const { octaveNoise, noise2D } = createNoiseGenerator();

  const tiles: TileType[][] = [];

  // Generate base terrain with noise
  for (let y = 0; y < MAP_HEIGHT; y++) {
    tiles[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Low-frequency elevation drives water/land split only
      const elevation = octaveNoise(x, y, 4, 0.5, 2, 0.02);
      const detail    = noise2D(x * 0.1, y * 0.1);
      // High-frequency noise creates small isolated tree clumps (~8-12 tiles wide)
      const treeNoise = octaveNoise(x + 500, y + 500, 3, 0.5, 2, 0.10);

      if (elevation < -0.48) {
        tiles[y][x] = TileType.DEEP_WATER;
      } else if (elevation < -0.34) {
        tiles[y][x] = TileType.SHALLOW_WATER;
      } else if (elevation > -0.1 && treeNoise > 0.40) {
        // Dense clump cores — only on dry land
        tiles[y][x] = TileType.DENSE_TREE;
      } else if (elevation > -0.15 && treeNoise > 0.20) {
        // Tree clump edges
        tiles[y][x] = TileType.TREE;
      } else if (detail > 0.4 && elevation > -0.2) {
        tiles[y][x] = TileType.TALL_GRASS;
      } else {
        tiles[y][x] = TileType.GRASS;
      }
    }
  }

  // Carve rivers
  carveRivers(tiles, noise2D);

  // Clear trees/dense-trees adjacent (including diagonally) to water so the
  // player always has a walkable shore to navigate around water bodies.
  clearWaterShore(tiles);

  // Place some dirt paths
  placePaths(tiles);

  // Place buildings (small abandoned structures)
  placeBuildings(tiles);

  // Place bridges over rivers at path crossings
  placeBridges(tiles);

  // Find player spawn first — needed as the flood-fill root for connectivity.
  const playerSpawn = findWalkablePosition(tiles, 20, 40, 20, 40);

  // Guarantee the entire walkable surface is one connected component:
  // BFS bridges rivers and clears trees wherever isolated land exists.
  ensureConnectivity(
    tiles,
    Math.floor(playerSpawn.x / TILE_SIZE),
    Math.floor(playerSpawn.y / TILE_SIZE),
  );

  // Divide the map into quadrants and pick one item per quadrant, avoiding
  // the player-spawn quadrant so items are spread across the map.
  const mid = MAP_WIDTH / 2; // map is square
  const margin = 15;
  const quadrants: [number, number, number, number][] = [
    [margin,   mid,     margin,   mid],      // top-left
    [mid,      MAP_WIDTH - margin, margin,   mid],      // top-right
    [margin,   mid,     mid,      MAP_HEIGHT - margin], // bottom-left
    [mid,      MAP_WIDTH - margin, mid,      MAP_HEIGHT - margin], // bottom-right
  ];
  // Shuffle quadrants so assignment varies each game
  for (let i = quadrants.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [quadrants[i], quadrants[j]] = [quadrants[j], quadrants[i]];
  }
  const carPosition   = findWalkablePosition(tiles, ...quadrants[0]);
  const keysPosition  = findWalkablePosition(tiles, ...quadrants[1]);
  const fuelPosition  = findWalkablePosition(tiles, ...quadrants[2]);

  // Generate enemy spawns away from the player
  const enemySpawns: Vector2[] = [];
  for (let i = 0; i < 18; i++) {
    let spawn = findWalkablePosition(tiles, 15, MAP_WIDTH - 15, 15, MAP_HEIGHT - 15);
    for (let retry = 0; retry < 10; retry++) {
      if (distance(spawn, playerSpawn) > 300) break;
      spawn = findWalkablePosition(tiles, 15, MAP_WIDTH - 15, 15, MAP_HEIGHT - 15);
    }
    enemySpawns.push(spawn);
  }

  return { tiles, playerSpawn, carPosition, keysPosition, fuelPosition, enemySpawns };
}

// ---------------------------------------------------------------------------
// Connectivity guarantee
// ---------------------------------------------------------------------------

const WALKABLE_TILES = new Set<TileType>([
  TileType.GRASS,
  TileType.TALL_GRASS,
  TileType.DIRT_PATH,
  TileType.BRIDGE,
  TileType.BUILDING_FLOOR,
  TileType.ROAD,
]);

function isTileWalkable(tile: TileType): boolean {
  return WALKABLE_TILES.has(tile);
}

/**
 * Flood-fill all walkable tiles reachable from (startX, startY).
 * Accumulates found keys into `out` and also returns them.
 */
function floodFillWalkable(
  tiles: TileType[][],
  startX: number,
  startY: number,
  out: Set<number>,
): Set<number> {
  if (!isTileWalkable(tiles[startY][startX])) return out;

  const queue: [number, number][] = [[startX, startY]];
  const startKey = startY * MAP_WIDTH + startX;
  if (out.has(startKey)) return out; // already visited
  out.add(startKey);

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]] as [number, number][]) {
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
      const nk = ny * MAP_WIDTH + nx;
      if (out.has(nk)) continue;
      if (!isTileWalkable(tiles[ny][nx])) continue;
      out.add(nk);
      queue.push([nx, ny]);
    }
  }

  return out;
}

/**
 * BFS from (startX, startY) through all tiles except BUILDING_WALL until a
 * tile in `mainComponent` is reached.  Returns the path from start to that
 * tile (inclusive at both ends), or null if unreachable.
 */
function bfsToMainComponent(
  tiles: TileType[][],
  mainComponent: Set<number>,
  startX: number,
  startY: number,
): [number, number][] | null {
  const startKey = startY * MAP_WIDTH + startX;

  // If start is already in the main component there's nothing to do.
  if (mainComponent.has(startKey)) return null;

  // parent: child key → parent key, -1 for the start node.
  const parent = new Map<number, number>();
  parent.set(startKey, -1);

  const queue: [number, number][] = [[startX, startY]];

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const ck = cy * MAP_WIDTH + cx;

    // Arrived at the main component — trace back and return the path.
    if (mainComponent.has(ck)) {
      const path: [number, number][] = [];
      let cur = ck;
      while (cur !== -1) {
        path.push([cur % MAP_WIDTH, Math.floor(cur / MAP_WIDTH)]);
        cur = parent.get(cur)!;
      }
      path.reverse();
      return path;
    }

    for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]] as [number, number][]) {
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
      const nk = ny * MAP_WIDTH + nx;
      if (parent.has(nk)) continue;
      if (tiles[ny][nx] === TileType.BUILDING_WALL) continue; // never destroy walls
      parent.set(nk, ck);
      queue.push([nx, ny]);
    }
  }

  return null; // no path (shouldn't happen on a bounded, finite grid)
}

/**
 * Ensure every walkable tile on the map is reachable from the player spawn:
 *  - Water gaps → BRIDGE
 *  - Tree gaps  → GRASS
 * Buildings are respected (walls are never modified).
 */
function ensureConnectivity(
  tiles: TileType[][],
  playerSpawnTileX: number,
  playerSpawnTileY: number,
): void {
  const mainComponent = new Set<number>();
  floodFillWalkable(tiles, playerSpawnTileX, playerSpawnTileY, mainComponent);

  // Safety cap: 500 iterations is far more than any realistic map needs.
  for (let iteration = 0; iteration < 500; iteration++) {
    // Find a disconnected walkable tile — prefer BUILDING_FLOOR so buildings
    // get their own dedicated bridge rather than relying on a path through
    // an adjacent region that might be connected later.
    let targetX = -1;
    let targetY = -1;

    outer: for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!isTileWalkable(tiles[y][x])) continue;
        if (mainComponent.has(y * MAP_WIDTH + x)) continue;
        if (tiles[y][x] === TileType.BUILDING_FLOOR) {
          targetX = x;
          targetY = y;
          break outer; // highest priority — stop immediately
        }
        if (targetX === -1) {
          targetX = x; // remember first non-floor candidate; keep scanning for floor
          targetY = y;
        }
      }
    }

    if (targetX === -1) break; // everything is connected

    const path = bfsToMainComponent(tiles, mainComponent, targetX, targetY);

    if (path === null) {
      // Truly unreachable (e.g. locked inside walls with no door) — skip to
      // avoid an infinite loop.
      mainComponent.add(targetY * MAP_WIDTH + targetX);
      continue;
    }

    // Convert non-walkable tiles along the path.
    for (const [px, py] of path) {
      const tile = tiles[py][px];
      if (!isTileWalkable(tile)) {
        if (tile === TileType.DEEP_WATER || tile === TileType.SHALLOW_WATER) {
          tiles[py][px] = TileType.BRIDGE;
        } else if (tile === TileType.TREE || tile === TileType.DENSE_TREE) {
          tiles[py][px] = TileType.GRASS;
        }
        // BUILDING_WALL is unreachable here because BFS skips it.
      }
    }

    // Absorb the newly connected region into mainComponent.
    floodFillWalkable(tiles, targetX, targetY, mainComponent);
  }
}

// ---------------------------------------------------------------------------
// Terrain generators
// ---------------------------------------------------------------------------

/**
 * For every water tile, convert any adjacent tree tile (all 8 directions) to
 * GRASS so the player always has a walkable shore to navigate around water.
 */
function clearWaterShore(tiles: TileType[][]): void {
  const isWater = (t: TileType) => t === TileType.DEEP_WATER || t === TileType.SHALLOW_WATER;
  const isTree  = (t: TileType) => t === TileType.TREE || t === TileType.DENSE_TREE;

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      if (!isWater(tiles[y][x])) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
          if (isTree(tiles[ny][nx])) tiles[ny][nx] = TileType.GRASS;
        }
      }
    }
  }
}

function carveRivers(tiles: TileType[][], noise2D: (x: number, y: number) => number) {
  // Carve 1-2 winding rivers (narrower than before)
  const riverCount = randomInt(1, 2);
  for (let r = 0; r < riverCount; r++) {
    let x = r === 0 ? randomInt(30, 60) : randomInt(MAP_WIDTH / 3, (MAP_WIDTH * 2) / 3);
    let y = 0;
    const xDrift = noise2D(r * 100, 0);

    while (y < MAP_HEIGHT) {
      const width = randomInt(1, 3);
      for (let dx = -width; dx <= width; dx++) {
        const tx = Math.round(x + dx);
        if (tx >= 0 && tx < MAP_WIDTH) {
          tiles[y][tx] = Math.abs(dx) >= width ? TileType.SHALLOW_WATER : TileType.DEEP_WATER;
        }
      }
      y++;
      x += noise2D(x * 0.05, y * 0.05) * 2 + xDrift * 0.3;
      x = Math.max(3, Math.min(MAP_WIDTH - 3, x));
    }
  }
}

function placePaths(tiles: TileType[][]) {
  // Create a few winding paths
  for (let p = 0; p < 5; p++) {
    let x = randomInt(10, MAP_WIDTH - 10);
    let y = randomInt(10, MAP_HEIGHT - 10);
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    for (let step = 0; step < 150; step++) {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
        if (tiles[ty][tx] === TileType.GRASS || tiles[ty][tx] === TileType.TALL_GRASS) {
          tiles[ty][tx] = TileType.DIRT_PATH;
          // Widen path
          if (tx + 1 < MAP_WIDTH && (tiles[ty][tx + 1] === TileType.GRASS || tiles[ty][tx + 1] === TileType.TALL_GRASS)) {
            tiles[ty][tx + 1] = TileType.DIRT_PATH;
          }
        }
      }
      x += dx + (Math.random() - 0.5) * 0.8;
      y += dy + (Math.random() - 0.5) * 0.8;
    }
  }
}

function placeBuildings(tiles: TileType[][]) {
  for (let b = 0; b < 6; b++) {
    const bx = randomInt(20, MAP_WIDTH - 30);
    const by = randomInt(20, MAP_HEIGHT - 30);
    const bw = randomInt(4, 7);
    const bh = randomInt(4, 7);

    // Skip if any tile in the footprint + 1-tile border is water (buildings on
    // land only; connectivity will bridge trees if needed).
    let hasWater = false;
    outer: for (let y = by - 1; y <= by + bh; y++) {
      for (let x = bx - 1; x <= bx + bw; x++) {
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;
        if (tiles[y][x] === TileType.DEEP_WATER || tiles[y][x] === TileType.SHALLOW_WATER) {
          hasWater = true;
          break outer;
        }
      }
    }
    if (hasWater) continue;

    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
          if (y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1) {
            tiles[y][x] = TileType.BUILDING_WALL;
          } else {
            tiles[y][x] = TileType.BUILDING_FLOOR;
          }
        }
      }
    }
    // Door at bottom-centre of wall
    const doorX = bx + Math.floor(bw / 2);
    if (doorX < MAP_WIDTH) {
      tiles[by + bh - 1][doorX] = TileType.BUILDING_FLOOR;
    }
  }
}

function placeBridges(tiles: TileType[][]) {
  const MAX_SPAN   = 8;
  const EXCL_ZONE  = 6; // tile buffer around every placed bridge — prevents intersections

  const isWater = (t: TileType) => t === TileType.DEEP_WATER || t === TileType.SHALLOW_WATER;
  const isLand  = (t: TileType) => !isWater(t) && t !== TileType.BUILDING_WALL;

  interface Candidate {
    span: [number, number][]; // ordered tile coords for the straight-line span
    hasPath: boolean;
  }

  // ── collect every valid crossing ────────────────────────────────────────────
  const candidates: Candidate[] = [];

  const BLOCKING = new Set<TileType>([TileType.TREE, TileType.DENSE_TREE, TileType.BUILDING_WALL]);

  // Returns true if any tile adjacent (4-way) to any span tile is a movement blocker.
  const spanAdjacentToBlocker = (span: [number, number][]): boolean =>
    span.some(([bx, by]) =>
      ([[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]).some(([dx, dy]) => {
        const nx = bx + dx, ny = by + dy;
        return nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT &&
          BLOCKING.has(tiles[ny][nx]);
      })
    );

  // Returns true if every tile in the span has a non-water neighbour
  // perpendicular to the bridge direction — meaning it's already touching ground
  // on all sides and doesn't need a bridge.
  const spanTouchesGroundEverywhere = (
    span: [number, number][],
    perpDirs: [number, number][],
  ): boolean =>
    span.every(([bx, by]) =>
      perpDirs.some(([dx, dy]) => {
        const nx = bx + dx, ny = by + dy;
        return nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT &&
          !isWater(tiles[ny][nx]);
      })
    );

  // Horizontal: land | water...water | land  (same row)
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    let x = 1;
    while (x < MAP_WIDTH - 1) {
      if (isWater(tiles[y][x]) && isLand(tiles[y][x - 1])) {
        let end = x;
        while (end < MAP_WIDTH && isWater(tiles[y][end])) end++;
        if (end < MAP_WIDTH && isLand(tiles[y][end]) && end - x <= MAX_SPAN) {
          const span: [number, number][] = [];
          for (let bx = x; bx < end; bx++) span.push([bx, y]);
          // Skip if every span tile already touches ground above or below,
          // or if any span tile is adjacent to a blocking tile (tree / wall).
          if (!spanTouchesGroundEverywhere(span, [[0, -1], [0, 1]]) &&
              !spanAdjacentToBlocker(span)) {
            const hasPath =
              tiles[y][x - 1] === TileType.DIRT_PATH ||
              tiles[y][end]   === TileType.DIRT_PATH;
            candidates.push({ span, hasPath });
          }
        }
        x = end + 1;
      } else {
        x++;
      }
    }
  }

  // Vertical: land / water...water / land  (same column)
  for (let x = 1; x < MAP_WIDTH - 1; x++) {
    let y = 1;
    while (y < MAP_HEIGHT - 1) {
      if (isWater(tiles[y][x]) && isLand(tiles[y - 1][x])) {
        let end = y;
        while (end < MAP_HEIGHT && isWater(tiles[end][x])) end++;
        if (end < MAP_HEIGHT && isLand(tiles[end][x]) && end - y <= MAX_SPAN) {
          const span: [number, number][] = [];
          for (let by = y; by < end; by++) span.push([x, by]);
          // Skip if every span tile already touches ground to the left or right,
          // or if any span tile is adjacent to a blocking tile (tree / wall).
          if (!spanTouchesGroundEverywhere(span, [[-1, 0], [1, 0]]) &&
              !spanAdjacentToBlocker(span)) {
            const hasPath =
              tiles[y - 1][x] === TileType.DIRT_PATH ||
              tiles[end][x]   === TileType.DIRT_PATH;
            candidates.push({ span, hasPath });
          }
        }
        y = end + 1;
      } else {
        y++;
      }
    }
  }

  // Prioritise path-adjacent crossings so dirt paths always cross rivers
  candidates.sort((a, b) => (b.hasPath ? 1 : 0) - (a.hasPath ? 1 : 0));

  // ── place bridges with an exclusion zone ────────────────────────────────────
  // Any tile within EXCL_ZONE of a placed bridge blocks future bridges,
  // which prevents both parallel near-duplicates and perpendicular intersections.
  const blocked = new Set<number>();

  const markZone = (bx: number, by: number) => {
    for (let dy = -EXCL_ZONE; dy <= EXCL_ZONE; dy++) {
      for (let dx = -EXCL_ZONE; dx <= EXCL_ZONE; dx++) {
        const nx = bx + dx, ny = by + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT)
          blocked.add(ny * MAP_WIDTH + nx);
      }
    }
  };

  for (const { span, hasPath } of candidates) {
    // Skip if any tile in this span is already in an exclusion zone
    if (span.some(([bx, by]) => blocked.has(by * MAP_WIDTH + bx))) continue;

    // Random filter — path crossings are almost always placed
    if (Math.random() > (hasPath ? 0.85 : 0.35)) continue;

    for (const [bx, by] of span) {
      tiles[by][bx] = TileType.BRIDGE;
      markZone(bx, by);
    }
  }
}

function findWalkablePosition(
  tiles: TileType[][],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): Vector2 {
  for (let attempt = 0; attempt < 500; attempt++) {
    const tx = randomInt(minX, maxX);
    const ty = randomInt(minY, maxY);
    if (
      tx >= 0 &&
      tx < MAP_WIDTH &&
      ty >= 0 &&
      ty < MAP_HEIGHT &&
      (tiles[ty][tx] === TileType.GRASS ||
        tiles[ty][tx] === TileType.TALL_GRASS ||
        tiles[ty][tx] === TileType.DIRT_PATH ||
        tiles[ty][tx] === TileType.BUILDING_FLOOR)
    ) {
      return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
    }
  }
  // Fallback
  return { x: (minX + maxX) / 2 * TILE_SIZE, y: (minY + maxY) / 2 * TILE_SIZE };
}
