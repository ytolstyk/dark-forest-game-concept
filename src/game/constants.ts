export const TILE_SIZE = 32;
export const MAP_WIDTH = 200;
export const MAP_HEIGHT = 200;
export const MAP_PIXEL_WIDTH = MAP_WIDTH * TILE_SIZE;
export const MAP_PIXEL_HEIGHT = MAP_HEIGHT * TILE_SIZE;

export const PLAYER_SPEED = 3;
export const ENEMY_PATROL_SPEED = 1;
export const ENEMY_CHASE_SPEED = 3.2;
export const LURKER_CHASE_SPEED = PLAYER_SPEED * 0.5; // 2.1 px/frame
export const ENEMY_SEARCH_SPEED = 1.5;
export const LESHEN_SPEED = PLAYER_SPEED / 3; // 1.5 px/frame — always slower than the player
export const LESHEN_PATH_INTERVAL = 45; // frames between A* recalculations
export const LESHEN_PATROL_RADIUS = MAP_WIDTH * TILE_SIZE * 0.4; // ~2560px — roams a large portion of the map

export const TORCH_RADIUS = 400;
export const LURKER_HEAR_RADIUS = TORCH_RADIUS / 2; // 200px — lurker detects player by sound
export const AMBIENT_LIGHT_RADIUS = 50;
export const DARKNESS_ALPHA = 0.82;

export const ENEMY_COUNT = 78;
export const ENEMY_SEARCH_DURATION = 180; // frames (~3 seconds at 60fps)
export const MAX_HEAR_DISTANCE = 400;

export const CAMERA_LERP = 0.1;

export const PATHFINDING_MAX_NODES = 500;

export const LESHEN_GLOW_COLOR = 0x33cc77; // sickly forest-green aura
export const LESHEN_GLOW_RADIUS = 28;

export const COLORS = {
  DEEP_WATER: 0x1a3a5c,
  SHALLOW_WATER: 0x2a5a8c,
  GRASS: 0x2d5a1e,
  GRASS_LIGHT: 0x3a6b2a,
  TALL_GRASS: 0x1e4a12,
  DIRT_PATH: 0x8b7355,
  TREE_TRUNK: 0x4a3728,
  TREE_CANOPY: 0x1a3a0e,
  DENSE_TREE: 0x0e2a06,
  BRIDGE: 0x8b6914,
  BUILDING_WALL: 0x5a5a5a,
  BUILDING_FLOOR: 0x4a4a3a,
  ROAD: 0x6b6355,
  PLAYER_BODY: 0xd4a574,
  PLAYER_SHIRT: 0x4a6fa5,
  ENEMY_BODY: 0x1a1a2e,
  ENEMY_EYES: 0xaaff44,
  TORCH_INNER: 0xffaa33,
  TORCH_OUTER: 0xff6600,
  KEY_COLOR: 0xffd700,
  FUEL_COLOR: 0xcc4444,
  CAR_COLOR: 0x6688aa,
  FENCE_WOOD: 0x7a5830,
  PROP_GROUND: 0x2d5a1e,
  TRACTOR_RUST: 0x4a3020,
};
