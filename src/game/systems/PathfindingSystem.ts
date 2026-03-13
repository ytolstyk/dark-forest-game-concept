import { TILE_SIZE, PATHFINDING_MAX_NODES, MAP_WIDTH, MAP_HEIGHT } from '../constants';
import type { Vector2 } from '../types';
import { isWalkable } from '../map/TileTypes';
import { TileType } from '../types';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class PathfindingSystem {
  private tiles: TileType[][] = [];

  setTiles(tiles: TileType[][]) {
    this.tiles = tiles;
  }

  findPath(startWorld: Vector2, endWorld: Vector2): Vector2[] | null {
    const startX = Math.floor(startWorld.x / TILE_SIZE);
    const startY = Math.floor(startWorld.y / TILE_SIZE);
    const endX = Math.floor(endWorld.x / TILE_SIZE);
    const endY = Math.floor(endWorld.y / TILE_SIZE);

    if (startX === endX && startY === endY) return [];
    if (!this.isValid(endX, endY)) return null;

    const open: PathNode[] = [];
    const closed = new Set<string>();
    let nodesExplored = 0;

    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.heuristic(startX, startY, endX, endY),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    open.push(startNode);

    while (open.length > 0 && nodesExplored < PATHFINDING_MAX_NODES) {
      // Find lowest f
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const current = open.splice(bestIdx, 1)[0];
      nodesExplored++;

      if (current.x === endX && current.y === endY) {
        return this.reconstructPath(current);
      }

      closed.add(`${current.x},${current.y}`);

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const n of neighbors) {
        if (!this.isValid(n.x, n.y)) continue;
        if (closed.has(`${n.x},${n.y}`)) continue;

        const g = current.g + 1;
        const h = this.heuristic(n.x, n.y, endX, endY);
        const existing = open.find((o) => o.x === n.x && o.y === n.y);

        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = g + existing.h;
            existing.parent = current;
          }
        } else {
          open.push({ x: n.x, y: n.y, g, h, f: g + h, parent: current });
        }
      }
    }

    return null; // No path found
  }

  private isValid(x: number, y: number): boolean {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
    return isWalkable(this.tiles[y][x]);
  }

  private heuristic(ax: number, ay: number, bx: number, by: number): number {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  private reconstructPath(node: PathNode): Vector2[] {
    const path: Vector2[] = [];
    let current: PathNode | null = node;
    while (current) {
      path.unshift({
        x: current.x * TILE_SIZE + TILE_SIZE / 2,
        y: current.y * TILE_SIZE + TILE_SIZE / 2,
      });
      current = current.parent;
    }
    return path;
  }
}
