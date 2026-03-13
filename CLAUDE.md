# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dark-forest** is a React 19 + TypeScript + Vite starter template. It provides a minimal setup for modern React development with fast refresh (HMR), TypeScript support, and ESLint configuration. The codebase is intentionally simple—a single-page app with basic component structure suitable for demonstrating setup and development workflow.

## Common Development Commands

```bash
# Development server (HMR enabled, runs on http://localhost:5173)
npm run dev

# Type checking and production build
npm run build

# Preview production build locally
npm run preview

# Lint with ESLint (flat config, TypeScript + React)
npm run lint
```

### Build Pipeline

The `build` script runs two steps in sequence:
1. `tsc -b` — TypeScript type checking using project references (tsconfig.json, tsconfig.app.json, tsconfig.node.json)
2. `vite build` — Bundles and optimizes for production with tree-shaking via Rolldown

Always run `npm run lint` before committing to catch issues early.

## Architecture & File Structure

```
src/
├── main.tsx           # Entry point: React 19 root setup with StrictMode
├── App.tsx            # Root component with basic UI (counter, links, sections)
├── App.css            # Component-scoped styling
├── index.css          # Global styles
└── assets/            # SVG logos and hero image
```

**Key Design Patterns:**

- **Vite + React Plugin**: Uses `@vitejs/plugin-react` with Oxc for JSX transformation
- **TypeScript**: Strict mode not enabled by default (see ESLint config for type-aware rule options in README.md)
- **CSS**: Plain CSS files (no CSS-in-JS or preprocessor)
- **State**: Simple React hooks (useState in App.tsx)

## TypeScript Configuration

- **tsconfig.json**: Base config with module "esnext" and target "ES2020"
- **tsconfig.app.json**: Application code (src/)
- **tsconfig.node.json**: Build tools (vite.config.ts, eslint.config.js)
- Type checking is strict for React types (`@types/react@19`, `@types/react-dom@19`)

## ESLint & Code Quality

**Flat Config** (eslint.config.js):
- ESLint 9+ with flat config format (defineConfig, globalIgnores)
- Recommended rules from @eslint/js, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh
- React Fast Refresh violations caught via react-refresh plugin
- Ignores dist/ directory

**To enable stricter type-aware rules** (production apps): See README.md—replace `tseslint.configs.recommended` with `.strictTypeChecked` and configure `parserOptions.project`.

## Vite Configuration

Minimal setup (vite.config.ts):
- React plugin enabled
- Default HMR on localhost:5173
- Build output to dist/
- Rolldown bundler for production builds

No custom aliases, API proxies, or environment-specific configs currently configured.

## Dependencies

**Production:**
- `react@19.2.4`
- `react-dom@19.2.4`

**Development:**
- TypeScript 5.9.3
- Vite 8.0.0
- ESLint 9.39 (flat config)
- React plugin ecosystem (@vitejs/plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh)

The template is intentionally minimal—add dependencies as features require them.

## Relevant Notes for Code Changes

1. **Entry Point**: src/main.tsx mounts the React app to `#root` in index.html. Changes to component tree always flow through this.
2. **HMR**: Edit src/App.tsx and save—Vite will refresh in-browser without full page reload.
3. **Static Assets**: SVG and image imports work via Vite's asset pipeline (src/assets/).
4. **Build & Deployment**: `npm run build` produces dist/ ready for static hosting (Vercel, GitHub Pages, etc.).
