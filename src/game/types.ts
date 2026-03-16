export interface Vector2 {
  x: number;
  y: number;
}

export const GameState = {
  MENU: 'menu',
  LOADING: 'loading',
  PLAYING: 'playing',
  GAME_OVER: 'game_over',
  WIN: 'win',
} as const;
export type GameState = (typeof GameState)[keyof typeof GameState];

export const EnemyState = {
  PATROL: 'patrol',
  CHASE: 'chase',
  SEARCH: 'search',
  RETURN: 'return',
} as const;
export type EnemyState = (typeof EnemyState)[keyof typeof EnemyState];

export const TileType = {
  DEEP_WATER: 0,
  SHALLOW_WATER: 1,
  GRASS: 2,
  TALL_GRASS: 3,
  DIRT_PATH: 4,
  TREE: 5,
  DENSE_TREE: 6,
  BRIDGE: 7,
  BUILDING_WALL: 8,
  BUILDING_FLOOR: 9,
  ROAD: 10,
  FENCE: 11,
  PROP: 12,
  TRACTOR: 13,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

export const EnemyType = {
  WATCHER: 'watcher', // glowing green eyes, detects via torch light
  LURKER: 'lurker',   // no eyes; yellow eyes appear when chasing; detects via hearing
  LESHEN: 'leshen',   // ancient forest spirit; once it detects the player it never stops chasing
} as const;
export type EnemyType = (typeof EnemyType)[keyof typeof EnemyType];

export const CollectibleType = {
  CAR: 'car',
  KEYS: 'keys',
  FUEL: 'fuel',
} as const;
export type CollectibleType = (typeof CollectibleType)[keyof typeof CollectibleType];

export interface Inventory {
  keys: boolean;
  fuel: boolean;
}
