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
      const elevation = octaveNoise(x, y, 4, 0.5, 2, 0.02);
      const moisture = octaveNoise(x + 1000, y + 1000, 3, 0.5, 2, 0.03);
      const detail = noise2D(x * 0.1, y * 0.1);

      if (elevation < -0.3) {
        tiles[y][x] = TileType.DEEP_WATER;
      } else if (elevation < -0.15) {
        tiles[y][x] = TileType.SHALLOW_WATER;
      } else if (elevation > 0.4 && moisture > 0.1) {
        tiles[y][x] = TileType.DENSE_TREE;
      } else if (elevation > 0.2 && moisture > -0.1) {
        tiles[y][x] = TileType.TREE;
      } else if (detail > 0.4 && elevation > -0.1) {
        tiles[y][x] = TileType.TALL_GRASS;
      } else {
        tiles[y][x] = TileType.GRASS;
      }
    }
  }

  // Carve rivers
  carveRivers(tiles, noise2D);

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

  const carPosition = findWalkablePosition(tiles, MAP_WIDTH - 40, MAP_WIDTH - 15, MAP_HEIGHT - 40, MAP_HEIGHT - 15);
  const keysPosition = findWalkablePosition(tiles, MAP_WIDTH / 2 - 30, MAP_WIDTH / 2 + 30, 20, MAP_HEIGHT / 2);
  const fuelPosition = findWalkablePosition(tiles, 20, MAP_WIDTH / 2, MAP_HEIGHT / 2, MAP_HEIGHT - 20);

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

function carveRivers(tiles: TileType[][], noise2D: (x: number, y: number) => number) {
  // Carve 2-3 winding rivers
  const riverCount = randomInt(2, 3);
  for (let r = 0; r < riverCount; r++) {
    let x = r === 0 ? randomInt(30, 60) : randomInt(MAP_WIDTH / 3, (MAP_WIDTH * 2) / 3);
    let y = 0;
    const xDrift = noise2D(r * 100, 0);

    while (y < MAP_HEIGHT) {
      const width = randomInt(2, 4);
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
  // Scan for path tiles near water and place bridges
  for (let y = 1; y < MAP_HEIGHT - 1; y++) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if (tiles[y][x] === TileType.DEEP_WATER || tiles[y][x] === TileType.SHALLOW_WATER) {
        const hasPathNearby =
          (x > 1 && tiles[y][x - 2] === TileType.DIRT_PATH) ||
          (x < MAP_WIDTH - 2 && tiles[y][x + 2] === TileType.DIRT_PATH) ||
          (y > 1 && tiles[y - 2][x] === TileType.DIRT_PATH) ||
          (y < MAP_HEIGHT - 2 && tiles[y + 2][x] === TileType.DIRT_PATH);

        if (hasPathNearby && Math.random() < 0.08) {
          tiles[y][x] = TileType.BRIDGE;
        }
      }
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
