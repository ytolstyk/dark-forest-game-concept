# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dark-forest** is a top-down browser survival game. The player explores a procedurally generated forest, collects keys and fuel, and escapes in a car while avoiding enemies.

Stack: React 19 (shell/HUD) + Pixi.js v8 (WebGL game renderer) + TypeScript + Vite 8.

## Common Development Commands

```bash
npm run dev       # Dev server with HMR — http://localhost:5173
npm run build     # tsc -b && vite build → dist/
npm run preview   # Serve dist/ locally
npm run lint      # ESLint (flat config)
```

The `build` script runs `tsc -b` first (type check) then `vite build`. Always run `npm run lint` before committing.

## Architecture & File Structure

```
src/
├── main.tsx                        # React root (StrictMode)
├── App.tsx                         # React shell: menu, loading bar, HUD, state machine
├── App.css / index.css
└── game/
    ├── Game.ts                     # Pixi Application wrapper; init / startGame / destroy
    ├── constants.ts                # All tunable numbers (TILE_SIZE, TORCH_RADIUS, etc.)
    ├── types.ts                    # TileType, GameState, EnemyState, CollectibleType enums
    ├── scenes/
    │   └── GameScene.ts            # Master update loop; owns all systems and entities
    ├── map/
    │   ├── MapGenerator.ts         # Procedural map: noise terrain, rivers, buildings, paths,
    │   │                           #   ensureConnectivity (BFS bridge pass)
    │   ├── TileMap.ts              # Renders tiles to chunked canvas textures (Pixi Sprites)
    │   └── TileTypes.ts            # TILE_WALKABLE and TILE_COLORS lookup tables; isWalkable()
    ├── entities/
    │   ├── Player.ts
    │   ├── Enemy.ts
    │   └── Collectible.ts          # Keys, fuel, car — uses Graphics.cut() for key ring shape
    ├── systems/
    │   ├── LightingSystem.ts       # Canvas 2D darkness overlay + radial gradient torch halo;
    │   │                           #   uploads to GPU via ImageSource.update() each frame
    │   ├── CollisionSystem.ts      # Tile-based AABB; delegates walkability to TileTypes
    │   ├── CameraSystem.ts         # Lerp camera following player
    │   ├── InputSystem.ts          # Keyboard state tracker
    │   ├── EnemyAISystem.ts        # patrol/chase/search/return FSM
    │   ├── PathfindingSystem.ts    # A* on tile grid
    │   └── AudioSystem.ts          # Web Audio API; footsteps, torch, growl, chase music
    ├── assets/
    │   ├── ParticleEffects.ts      # Torch sparks and ambient dust
    │   ├── SpriteFactory.ts
    │   └── TileRenderer.ts
    └── utils/
        ├── math.ts                 # randomInt, distance, etc.
        └── noise.ts                # simplex-noise wrapper: noise2D, octaveNoise
```

## Key Design Patterns

### React / Pixi split
React owns the overlay UI (menu, loading, HUD, game-over). Pixi owns everything inside the `<canvas>`. They communicate via `game.onStateChange()` callbacks and a 100 ms polling interval for HUD values (`torchOn`, `inventory`).

### React StrictMode double-mount
`Game.init()` is called inside `useEffect`. In development, StrictMode mounts → unmounts → remounts. The guard in `Game.ts` calls `app.stop()` (not `app.destroy()`) on the first (destroyed) instance to avoid killing the shared WebGL context before the second instance can use it.

### Lighting system
`LightingSystem` draws darkness to an offscreen `HTMLCanvasElement` using Canvas 2D composite operations (`destination-out` radial gradient for the torch halo), then uploads it to a Pixi `ImageSource` via `source.update()`. The `Sprite` that holds this texture must **not** have its `width`/`height` set manually — doing so scales relative to the initial 1×1 texture size and makes the sprite render at `screen²` pixels.

### Map connectivity
After all terrain, rivers, and buildings are placed, `ensureConnectivity()` in `MapGenerator.ts` runs a flood-fill from the player spawn to find the main walkable component, then BFS-bridges any isolated walkable region: water gaps → `BRIDGE`, tree gaps → `GRASS`. Buildings are never destroyed (BUILDING_WALL tiles are skipped by the BFS). This guarantees every building, item spawn, and land section is reachable.

### Tile rendering
`TileMap.render()` bakes all tiles into 50×50-tile canvas chunks, then creates a Pixi `Sprite` per chunk. This runs once at load time (async, yielding each chunk so the loading bar stays responsive).

## Constants to Know

`src/game/constants.ts` is the single source of truth for tuning:

| Constant | Default | Effect |
|---|---|---|
| `TILE_SIZE` | 32 | Pixels per tile |
| `MAP_WIDTH / MAP_HEIGHT` | 200 / 200 | Map size in tiles |
| `TORCH_RADIUS` | 200 | Lit radius (px) when torch on |
| `AMBIENT_LIGHT_RADIUS` | 60 | Lit radius (px) when torch off |
| `DARKNESS_ALPHA` | 0.82 | Opacity of the darkness overlay |
| `PLAYER_SPEED` | 3 | Pixels per frame |
| `ENEMY_CHASE_SPEED` | 2.5 | Pixels per frame |

## Walkable Tiles

Only these tiles pass `isWalkable()` and can be navigated by the player and enemies:
`GRASS`, `TALL_GRASS`, `DIRT_PATH`, `BRIDGE`, `BUILDING_FLOOR`, `ROAD`

Water (`DEEP_WATER`, `SHALLOW_WATER`), trees (`TREE`, `DENSE_TREE`), and `BUILDING_WALL` block movement.
