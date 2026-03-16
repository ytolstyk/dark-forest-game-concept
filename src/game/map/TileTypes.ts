import { TileType } from '../types';
import { COLORS } from '../constants';

export const TILE_WALKABLE: Record<TileType, boolean> = {
  [TileType.DEEP_WATER]: false,
  [TileType.SHALLOW_WATER]: false,
  [TileType.GRASS]: true,
  [TileType.TALL_GRASS]: true,
  [TileType.DIRT_PATH]: true,
  [TileType.TREE]: false,
  [TileType.DENSE_TREE]: false,
  [TileType.BRIDGE]: true,
  [TileType.BUILDING_WALL]: false,
  [TileType.BUILDING_FLOOR]: true,
  [TileType.ROAD]: true,
  [TileType.FENCE]: false,
  [TileType.PROP]: true,
  [TileType.TRACTOR]: false,
};

export const TILE_COLORS: Record<TileType, number> = {
  [TileType.DEEP_WATER]: COLORS.DEEP_WATER,
  [TileType.SHALLOW_WATER]: COLORS.SHALLOW_WATER,
  [TileType.GRASS]: COLORS.GRASS,
  [TileType.TALL_GRASS]: COLORS.TALL_GRASS,
  [TileType.DIRT_PATH]: COLORS.DIRT_PATH,
  [TileType.TREE]: COLORS.TREE_CANOPY,
  [TileType.DENSE_TREE]: COLORS.DENSE_TREE,
  [TileType.BRIDGE]: COLORS.BRIDGE,
  [TileType.BUILDING_WALL]: COLORS.BUILDING_WALL,
  [TileType.BUILDING_FLOOR]: COLORS.BUILDING_FLOOR,
  [TileType.ROAD]: COLORS.ROAD,
  [TileType.FENCE]: COLORS.FENCE_WOOD,
  [TileType.PROP]: COLORS.PROP_GROUND,
  [TileType.TRACTOR]: COLORS.TRACTOR_RUST,
};

export function isWalkable(tile: TileType): boolean {
  return TILE_WALKABLE[tile] ?? false;
}
