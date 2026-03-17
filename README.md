# Dark Forest

A top-down survival game built with React 19, TypeScript, Vite, and Pixi.js v8.

You wake up in a dark forest. Find the **keys** and **fuel**, then reach the **car** to escape — before the creatures find you.

[https://main.drhl42a9wuetq.amplifyapp.com/](https://main.drhl42a9wuetq.amplifyapp.com/)

## How to Play

| Input               | Action       |
| ------------------- | ------------ |
| `WASD` / Arrow Keys | Move         |
| `Space`             | Toggle torch |

- Your torch reveals a wide area but **attracts enemies** — use it wisely
- Without the torch you have only a faint ambient glow
- Enemies patrol the forest; if they spot or hear you they give chase
- Collect the **keys** and **fuel** (shown in the HUD), then walk to the **car**

## Running Locally

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # type-check + production bundle → dist/
npm run preview    # serve dist/ locally
npm run lint       # ESLint
```

## Tech Stack

| Layer      | Technology           |
| ---------- | -------------------- |
| UI / shell | React 19, TypeScript |
| Renderer   | Pixi.js v8 (WebGL)   |
| Bundler    | Vite 8 + Rolldown    |
| Noise      | simplex-noise v4     |

## Features

- **Procedural map** — simplex-noise terrain with rivers, forests, dirt paths, abandoned buildings, spider webs, and random objects generated fresh every run
- **Guaranteed connectivity** — flood-fill post-pass bridges any isolated land section so every building and item is always reachable
- **Lighting system** — Canvas 2D radial-gradient darkness overlay with a soft, flickering torch halo; torch radius vs ambient radius controlled in `constants.ts`
- **Enemy AI** — patrol → chase → search → return state machine with A\* pathfinding
- **The Leshen** — an ancient forest spirit that, once it detects you, never stops chasing (can be toggled in Options)
- **Crow flocks** — ambient wildlife that scatter when disturbed
- **Heart rate monitor** — live BPM widget that reacts to danger; avg and peak heart rate shown on the end screen
- **Game timer & step counter** — track survival time and distance walked, shown at game end
- **Options menu** — tune volume, monster count, and toggle the Leshen before starting
- **Mobile controls** — virtual joystick and torch button for touchscreen play
- **Particle effects** — torch sparks, ambient dust
- **Audio** — footsteps, torch crackle, enemy growl, Leshen pulse, chase music, pickup sounds
