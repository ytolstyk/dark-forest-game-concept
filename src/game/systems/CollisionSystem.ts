import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../constants';
import { TileType } from '../types';
import type { Vector2 } from '../types';
import { isWalkable } from '../map/TileTypes';
import { distance } from '../utils/math';

export class CollisionSystem {
  private tiles: TileType[][] = [];

  setTiles(tiles: TileType[][]) {
    this.tiles = tiles;
  }

  getTile(tileX: number, tileY: number): TileType {
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
      return TileType.DEEP_WATER;
    }
    return this.tiles[tileY][tileX];
  }

  isTileWalkable(tileX: number, tileY: number): boolean {
    return isWalkable(this.getTile(tileX, tileY));
  }

  canMoveTo(x: number, y: number, radius: number = 8): boolean {
    // Check 4 corners of hitbox
    const offsets = [
      { x: -radius, y: -radius },
      { x: radius, y: -radius },
      { x: -radius, y: radius },
      { x: radius, y: radius },
    ];

    for (const offset of offsets) {
      const tileX = Math.floor((x + offset.x) / TILE_SIZE);
      const tileY = Math.floor((y + offset.y) / TILE_SIZE);
      if (!this.isTileWalkable(tileX, tileY)) {
        return false;
      }
    }
    return true;
  }

  circleCollision(a: Vector2, radiusA: number, b: Vector2, radiusB: number): boolean {
    return distance(a, b) < radiusA + radiusB;
  }
}
