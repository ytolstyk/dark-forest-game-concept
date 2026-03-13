import { Graphics, Container, Sprite, Texture, ImageSource } from 'pixi.js';
import { TORCH_RADIUS, AMBIENT_LIGHT_RADIUS, DARKNESS_ALPHA } from '../constants';
import type { Vector2 } from '../types';

interface GlowSource {
  position: Vector2;
  color: number;
  radius: number;
  alpha: number;
}

export class LightingSystem {
  // Canvas 2D is used for the darkness + light gradient (destination-out composite).
  // This avoids Pixi.js blend-mode edge cases entirely.
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
    const texture = new Texture({ source: this.source });
    this.sprite = new Sprite(texture);

    this.glowLayer = new Container();
    this.glowGraphics = new Graphics();
    this.glowLayer.addChild(this.glowGraphics);
  }

  getDarkness(): Container {
    return this.sprite;
  }

  getGlowLayer(): Container {
    return this.glowLayer;
  }

  update(
    playerPos: Vector2,
    torchOn: boolean,
    cameraX: number,
    cameraY: number,
    screenWidth: number,
    screenHeight: number,
    enemyGlows: GlowSource[],
    itemGlows: GlowSource[]
  ) {
    const w = Math.ceil(screenWidth);
    const h = Math.ceil(screenHeight);

    // Resize canvas when screen dimensions change.
    // Do NOT set sprite.width/height — that sets scale relative to the current
    // texture size (1×1 initially) and would make the sprite render at screen²
    // pixels once the texture updates, clipping the lighting off-screen.
    // Leaving scale at the default (1,1) lets the sprite naturally fill
    // the screen once the texture reaches the correct dimensions.
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const lightRadius = torchOn ? TORCH_RADIUS : AMBIENT_LIGHT_RADIUS;
    const cx = playerPos.x + cameraX;
    const cy = playerPos.y + cameraY;

    // 1. Fill screen with darkness
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = `rgba(0,0,0,${DARKNESS_ALPHA})`;
    this.ctx.fillRect(0, 0, w, h);

    // 2. Punch a soft gradient halo using destination-out + radial gradient.
    //    The gradient removes alpha from the darkness: fully at center, not at all at edge.
    this.ctx.globalCompositeOperation = 'destination-out';
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, lightRadius);
    grad.addColorStop(0,   `rgba(0,0,0,${DARKNESS_ALPHA})`);
    grad.addColorStop(0.5, `rgba(0,0,0,${DARKNESS_ALPHA * 0.5})`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.globalCompositeOperation = 'source-over';

    // 3. Push updated canvas pixels to the GPU texture
    this.source.update();

    // 4. Glow layer: enemy eyes and item highlights drawn above the darkness
    this.glowGraphics.clear();
    for (const glow of enemyGlows) {
      const sx = glow.position.x + cameraX;
      const sy = glow.position.y + cameraY;
      this.glowGraphics.circle(sx, sy, glow.radius);
      this.glowGraphics.fill({ color: glow.color, alpha: glow.alpha });
    }
    for (const glow of itemGlows) {
      const sx = glow.position.x + cameraX;
      const sy = glow.position.y + cameraY;
      this.glowGraphics.circle(sx, sy, glow.radius);
      this.glowGraphics.fill({ color: glow.color, alpha: glow.alpha });
    }
  }

  destroy() {
    this.sprite.texture.destroy();
    this.sprite.destroy();
    this.glowLayer.destroy({ children: true });
  }
}
