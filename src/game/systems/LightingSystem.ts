import { Graphics, Container, Sprite, Texture, ImageSource } from 'pixi.js';
import { TORCH_RADIUS, AMBIENT_LIGHT_RADIUS, TILE_SIZE } from '../constants';
import { TileType } from '../types';
import type { Vector2 } from '../types';

interface GlowSource {
  position: Vector2;
  color: number;
  radius: number;
  alpha: number;
}

// Tile types that block light and cast shadows
const SHADOW_CASTERS = new Set<TileType>([
  TileType.TREE,
  TileType.DENSE_TREE,
  TileType.BUILDING_WALL,
]);

// Extra angles around the full circle so the polygon is smooth in open areas
const BOUNDARY_STEPS = 90;

export class LightingSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private source: ImageSource;
  private sprite: Sprite;
  private glowLayer: Container;
  private glowGraphics: Graphics;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d canvas context');
    this.ctx = ctx;
    this.source = new ImageSource({ resource: this.canvas });
    const texture = new Texture({ source: this.source, dynamic: true });
    this.sprite = new Sprite(texture);
    this.glowLayer = new Container();
    this.glowGraphics = new Graphics();
    this.glowLayer.addChild(this.glowGraphics);
  }

  getDarkness(): Container { return this.sprite; }
  getGlowLayer(): Container { return this.glowLayer; }

  update(
    playerPos: Vector2,
    torchOn: boolean,
    cameraX: number,
    cameraY: number,
    screenWidth: number,
    screenHeight: number,
    tiles: TileType[][],
    enemyGlows: GlowSource[],
    itemGlows: GlowSource[],
    zoom = 1,
  ) {
    const w = Math.ceil(screenWidth);
    const h = Math.ceil(screenHeight);

    // Resize canvas when screen dimensions change.
    // Do NOT set sprite.width/height — that sets scale relative to the current
    // texture size (1×1 initially) and would make the sprite render at screen²
    // pixels once the texture updates, clipping the lighting off-screen.
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const screenX = playerPos.x * zoom + cameraX;
    const screenY = playerPos.y * zoom + cameraY;

    // 1. Fill the entire canvas with opaque black — complete darkness by default
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.globalCompositeOperation = 'destination-out';

    // 2. Ambient sight — always visible tiny circle so the player isn't completely blind
    const ambGrad = this.ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, AMBIENT_LIGHT_RADIUS * zoom);
    ambGrad.addColorStop(0,   'rgba(0,0,0,1)');
    ambGrad.addColorStop(0.7, 'rgba(0,0,0,0.6)');
    ambGrad.addColorStop(1,   'rgba(0,0,0,0)');
    this.ctx.fillStyle = ambGrad;
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, AMBIENT_LIGHT_RADIUS * zoom, 0, Math.PI * 2);
    this.ctx.fill();

    // 3. Torch — shadow-casting visibility polygon with soft gradient falloff
    if (torchOn) {
      const polygon = this.buildVisibilityPolygon(
        screenX, screenY,
        playerPos.x, playerPos.y,
        TORCH_RADIUS,
        tiles,
        zoom,
      );

      if (polygon.length >= 3) {
        this.ctx.save();
        // Clip rendering to the visible (unblocked) region
        this.ctx.beginPath();
        this.ctx.moveTo(polygon[0][0], polygon[0][1]);
        for (let i = 1; i < polygon.length; i++) {
          this.ctx.lineTo(polygon[i][0], polygon[i][1]);
        }
        this.ctx.closePath();
        this.ctx.clip();

        // Radial gradient falloff within the polygon (bright at center, fades at edge)
        const torchGrad = this.ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, TORCH_RADIUS * zoom);
        torchGrad.addColorStop(0,    'rgba(0,0,0,1)');
        torchGrad.addColorStop(0.55, 'rgba(0,0,0,0.95)');
        torchGrad.addColorStop(0.85, 'rgba(0,0,0,0.55)');
        torchGrad.addColorStop(1,    'rgba(0,0,0,0)');
        this.ctx.fillStyle = torchGrad;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.restore();
      }
    }

    this.ctx.globalCompositeOperation = 'source-over';

    // 3. Push updated canvas pixels to the GPU texture
    this.source.update();

    // 4. Glow layer — enemy eyes and item highlights drawn above the darkness
    this.glowGraphics.clear();
    for (const glow of [...enemyGlows, ...itemGlows]) {
      const sx = glow.position.x * zoom + cameraX;
      const sy = glow.position.y * zoom + cameraY;
      this.glowGraphics.circle(sx, sy, glow.radius);
      this.glowGraphics.fill({ color: glow.color, alpha: glow.alpha });
    }
  }

  /**
   * Build a 2D visibility polygon using the endpoint shadow-casting algorithm:
   *  1. Collect corner angles from all shadow-casting tiles within radius
   *  2. Cast a ray at each angle (+ boundary samples for smooth open areas)
   *  3. Sort hit-points by angle → polygon
   */
  private buildVisibilityPolygon(
    screenX: number, screenY: number,
    worldX: number, worldY: number,
    radius: number,
    tiles: TileType[][],
    zoom = 1,
  ): [number, number][] {
    const mapH = tiles.length;
    const mapW = tiles[0]?.length ?? 0;
    const tileRadius = Math.ceil(radius / TILE_SIZE) + 1;
    const originTX = Math.floor(worldX / TILE_SIZE);
    const originTY = Math.floor(worldY / TILE_SIZE);
    const minTX = Math.max(0,       originTX - tileRadius);
    const maxTX = Math.min(mapW - 1, originTX + tileRadius);
    const minTY = Math.max(0,       originTY - tileRadius);
    const maxTY = Math.min(mapH - 1, originTY + tileRadius);

    const angles: number[] = [];
    const r2 = radius * radius;

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (!SHADOW_CASTERS.has(tiles[ty][tx])) continue;

        // Skip interior tiles (all 4 neighbours are also blockers) — they have
        // no visible faces and their corners never produce meaningful shadows.
        let hasOpen = false;
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH ||
              !SHADOW_CASTERS.has(tiles[ny][nx])) {
            hasOpen = true;
            break;
          }
        }
        if (!hasOpen) continue;

        // Cast rays at each of the 4 tile corners (plus ±ε for crisp shadow edges)
        const corners: [number, number][] = [
          [tx       * TILE_SIZE, ty       * TILE_SIZE],
          [(tx + 1) * TILE_SIZE, ty       * TILE_SIZE],
          [tx       * TILE_SIZE, (ty + 1) * TILE_SIZE],
          [(tx + 1) * TILE_SIZE, (ty + 1) * TILE_SIZE],
        ];
        for (const [cx, cy] of corners) {
          const ddx = cx - worldX;
          const ddy = cy - worldY;
          if (ddx * ddx + ddy * ddy > r2) continue;
          const a = Math.atan2(ddy, ddx);
          angles.push(a - 0.00001, a, a + 0.00001);
        }
      }
    }

    // Evenly-spaced boundary samples — ensures a smooth circle arc in open areas
    for (let i = 0; i < BOUNDARY_STEPS; i++) {
      angles.push(-Math.PI + (i / BOUNDARY_STEPS) * Math.PI * 2);
    }

    angles.sort((a, b) => a - b);

    const points: [number, number][] = [];
    for (const angle of angles) {
      const [wx, wy] = this.castRay(worldX, worldY, angle, radius, tiles, mapW, mapH);
      // Convert world → screen coords
      points.push([(wx - worldX) * zoom + screenX, (wy - worldY) * zoom + screenY]);
    }

    return points;
  }

  /**
   * DDA ray march: walk tile-by-tile from (ox, oy) in direction `angle` until
   * a shadow-caster tile is hit or `maxDist` is reached.
   * Returns the world-space hit point.
   */
  private castRay(
    ox: number, oy: number,
    angle: number,
    maxDist: number,
    tiles: TileType[][],
    mapW: number,
    mapH: number,
  ): [number, number] {
    const rdx = Math.cos(angle);
    const rdy = Math.sin(angle);

    let mapX = Math.floor(ox / TILE_SIZE);
    let mapY = Math.floor(oy / TILE_SIZE);

    const stepX = rdx >= 0 ? 1 : -1;
    const stepY = rdy >= 0 ? 1 : -1;

    // Distance along the ray to the first tile-edge crossing in each axis
    let tMaxX: number;
    if (rdx === 0)      tMaxX = Infinity;
    else if (rdx > 0)   tMaxX = ((mapX + 1) * TILE_SIZE - ox) / rdx;
    else                tMaxX = (mapX       * TILE_SIZE - ox) / rdx;

    let tMaxY: number;
    if (rdy === 0)      tMaxY = Infinity;
    else if (rdy > 0)   tMaxY = ((mapY + 1) * TILE_SIZE - oy) / rdy;
    else                tMaxY = (mapY       * TILE_SIZE - oy) / rdy;

    const tDeltaX = rdx !== 0 ? TILE_SIZE / Math.abs(rdx) : Infinity;
    const tDeltaY = rdy !== 0 ? TILE_SIZE / Math.abs(rdy) : Infinity;

    let t = 0;

    while (t < maxDist) {
      if (tMaxX < tMaxY) {
        t = tMaxX;
        if (t >= maxDist) break;
        mapX += stepX;
        tMaxX += tDeltaX;
      } else {
        t = tMaxY;
        if (t >= maxDist) break;
        mapY += stepY;
        tMaxY += tDeltaY;
      }

      if (mapX < 0 || mapX >= mapW || mapY < 0 || mapY >= mapH) break;

      if (SHADOW_CASTERS.has(tiles[mapY][mapX])) {
        return [ox + rdx * t, oy + rdy * t];
      }
    }

    return [ox + rdx * maxDist, oy + rdy * maxDist];
  }

  destroy() {
    this.sprite.texture.destroy();
    this.sprite.destroy();
    this.glowLayer.destroy({ children: true });
  }
}
