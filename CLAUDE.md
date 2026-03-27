# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dark-forest** is a top-down browser survival game. The player explores a procedurally generated forest, collects keys and fuel, and escapes in a car while avoiding enemies.

Stack: React 19 (shell/HUD) + Pixi.js v8 (WebGL game renderer) + TypeScript + Vite 8 + AWS Amplify (leaderboard backend) + Mantine v8 (UI components).

## Common Development Commands

```bash
npm run dev       # Dev server with HMR — http://localhost:5173
rtk tsc                     # Type-check (tsc -b)
rtk err npm run build       # Production build (vite build)
rtk lint                    # ESLint (flat config, v9+)
npm run preview   # Serve dist/ locally
```

The `build` script runs `tsc -b` first (type check) then `vite build`. Always run `npm run lint` before committing.

The `vite.config.ts` injects `__COMMIT_HASH__` (via `git rev-parse --short HEAD`) as a global so the footer can display the current build hash.

## Architecture & File Structure

```
src/
├── main.tsx                        # React root (StrictMode)
├── App.tsx                         # React shell: menu, loading bar, HUD, state machine
├── App.css / index.css
├── env.d.ts
├── components/                     # Modular React UI components
│   ├── Leaderboard.tsx             # Expandable leaderboard with stat columns
│   ├── PauseModal.tsx              # In-game pause menu
│   └── SubmitScoreModal.tsx        # End-of-game score submission form
├── lib/
│   ├── leaderboard.ts              # AWS Amplify leaderboard fetch/submit
│   └── storage.ts                  # localStorage helpers (userId, username)
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
    │   ├── CrowFlock.ts            # Crow flock entity; perched/scattered states, flocking physics
    │   └── Collectible.ts          # Keys, fuel, car — uses Graphics.cut() for key ring shape
    ├── systems/
    │   ├── LightingSystem.ts       # Canvas 2D darkness overlay + radial gradient torch halo;
    │   │                           #   uploads to GPU via ImageSource.update() each frame
    │   ├── CollisionSystem.ts      # Tile-based AABB; delegates walkability to TileTypes
    │   ├── CameraSystem.ts         # Lerp camera following player
    │   ├── InputSystem.ts          # Keyboard state tracker
    │   ├── EnemyAISystem.ts        # patrol/chase/search/return FSM; handles Leshen & Lurker
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

Menu navigation has multiple states: `"main"`, `"difficulty"`, `"custom-settings"`, `"options"`, `"leaderboard"`.

### React StrictMode double-mount

`Game.init()` is called inside `useEffect`. In development, StrictMode mounts → unmounts → remounts. The guard in `Game.ts` calls `app.stop()` (not `app.destroy()`) on the first (destroyed) instance to avoid killing the shared WebGL context before the second instance can use it.

### Lighting system

`LightingSystem` draws darkness to an offscreen `HTMLCanvasElement` using Canvas 2D composite operations (`destination-out` radial gradient for the torch halo), then uploads it to a Pixi `ImageSource` via `source.update()`. The `Sprite` that holds this texture must **not** have its `width`/`height` set manually — doing so scales relative to the initial 1×1 texture size and makes the sprite render at `screen²` pixels.

### Map connectivity

After all terrain, rivers, and buildings are placed, `ensureConnectivity()` in `MapGenerator.ts` runs a flood-fill from the player spawn to find the main walkable component, then BFS-bridges any isolated walkable region: water gaps → `BRIDGE`, tree gaps → `GRASS`. Buildings are never destroyed (BUILDING_WALL tiles are skipped by the BFS). This guarantees every building, item spawn, and land section is reachable.

### Tile rendering

`TileMap.render()` bakes all tiles into 50×50-tile canvas chunks, then creates a Pixi `Sprite` per chunk. This runs once at load time (async, yielding each chunk so the loading bar stays responsive).

### Difficulty system

`App.tsx` defines a `GameOptions` interface (`monsterCount`, `leshenEnabled`, `torchBurnoutEnabled`, `torchTimerSeconds`) and preset difficulty levels (easy / normal / hard / custom). Options are passed into `Game.startGame()` and forwarded to `GameScene`. Leaderboard entries are tagged by difficulty so scores are filtered correctly.

### Leaderboard / backend

`lib/leaderboard.ts` wraps AWS Amplify for score submission and fetching. `lib/storage.ts` persists a random `userId` and `username` in localStorage. Scores include: steps, enemies noticed, crow interactions, peak/avg heart rate, Leshen encounters, time elapsed.

## Constants to Know

`src/game/constants.ts` is the single source of truth for tuning:

| Constant                 | Default   | Effect                                      |
| ------------------------ | --------- | ------------------------------------------- |
| `TILE_SIZE`              | 32        | Pixels per tile                             |
| `MAP_WIDTH / MAP_HEIGHT` | 200 / 200 | Map size in tiles                           |
| `TORCH_RADIUS`           | 400       | Lit radius (px) when torch on               |
| `AMBIENT_LIGHT_RADIUS`   | 50        | Lit radius (px) when torch off              |
| `DARKNESS_ALPHA`         | 0.82      | Opacity of the darkness overlay             |
| `PLAYER_SPEED`           | 3         | Pixels per frame                            |
| `ENEMY_CHASE_SPEED`      | 3.2       | Pixels per frame (Watcher)                  |
| `LURKER_CHASE_SPEED`     | 1.5       | Lurker chase speed (0.5× player)            |
| `LESHEN_SPEED`           | 1         | Leshen boss speed (1/3 player)              |
| `LESHEN_PATH_INTERVAL`   | 45        | Frames between Leshen A* recalculations     |
| `SPIDER_WEB_SLOW`        | 0.5       | Movement multiplier on SPIDER_WEB tiles     |
| `ENEMY_COUNT`            | 78        | Total enemy spawns                          |

## Enemy Types

| Type    | Detection        | Behavior                                                         |
| ------- | ---------------- | ---------------------------------------------------------------- |
| Watcher | Light (torch)    | Patrol → chase → search → return FSM                            |
| Lurker  | Sound (movement) | Same FSM; yellow eyes appear on chase; `LURKER_HEAR_RADIUS` = 200 px |
| Leshen  | Either           | Boss; once alerted never stops; A* every 45 frames; green glow  |

Crow flocks (entity, not enemy) are ambient wildlife that scatter when the player's torch is nearby.

## Walkable Tiles

Only these tiles pass `isWalkable()` and can be navigated by the player and enemies:
`GRASS`, `TALL_GRASS`, `DIRT_PATH`, `BRIDGE`, `BUILDING_FLOOR`, `ROAD`

Water (`DEEP_WATER`, `SHALLOW_WATER`), trees (`TREE`, `DENSE_TREE`), `BUILDING_WALL`, `FENCE`, `PROP`, and `TRACTOR` block movement. `SPIDER_WEB` is walkable but slows the player.
