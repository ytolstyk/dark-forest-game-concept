# Dark Forest

A top-down survival game built with React 19, TypeScript, Vite, and Pixi.js v8.

You wake up in a dark forest. Find the **keys** and **fuel**, then reach the **car** to escape — before the creatures find you.

## How to Play

| Input | Action |
|---|---|
| `WASD` / Arrow Keys | Move |
| `Space` | Toggle torch |

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

| Layer | Technology |
|---|---|
| UI / shell | React 19, TypeScript |
| Renderer | Pixi.js v8 (WebGL) |
| Bundler | Vite 8 + Rolldown |
| Noise | simplex-noise v4 |

## Features

- **Procedural map** — simplex-noise terrain with rivers, forests, dirt paths, and abandoned buildings generated fresh every run
- **Guaranteed connectivity** — flood-fill post-pass bridges any isolated land section so every building and item is always reachable
- **Lighting system** — Canvas 2D radial-gradient darkness overlay with a soft torch halo; torch radius vs ambient radius controlled in `constants.ts`
- **Enemy AI** — patrol → chase → search → return state machine with A\* pathfinding
- **Particle effects** — torch sparks, ambient dust
- **Audio** — footsteps, torch crackle, enemy growl, chase music, pickup sounds
