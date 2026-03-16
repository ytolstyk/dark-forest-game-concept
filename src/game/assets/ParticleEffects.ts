import { Graphics, Container } from 'pixi.js';
import type { Vector2 } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

export class ParticleEffects {
  container: Container;
  private torchParticles: Particle[] = [];
  private fireflyParticles: Particle[] = [];
  private graphics: Graphics;
  private time = 0;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

    // Pre-create fireflies
    for (let i = 0; i < 30; i++) {
      this.fireflyParticles.push({
        x: Math.random() * 6400,
        y: Math.random() * 6400,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        life: Math.random() * 200,
        maxLife: 200,
        size: 1.5 + Math.random(),
        color: 0x88ff44,
      });
    }
  }

  update(playerPos: Vector2, torchOn: boolean, cameraX: number, cameraY: number, zoom = 1) {
    this.time++;
    this.graphics.clear();

    // Torch fire particles
    if (torchOn) {
      if (this.time % 2 === 0) {
        this.torchParticles.push({
          x: playerPos.x + (Math.random() - 0.5) * 8,
          y: playerPos.y - 10,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -1 - Math.random() * 1.5,
          life: 30 + Math.random() * 20,
          maxLife: 50,
          size: 2 + Math.random() * 2,
          color: Math.random() > 0.5 ? 0xff8833 : 0xffaa00,
        });
      }
    }

    // Update and draw torch particles
    for (let i = this.torchParticles.length - 1; i >= 0; i--) {
      const p = this.torchParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.torchParticles.splice(i, 1);
        continue;
      }
      const alpha = p.life / p.maxLife;
      const sx = p.x * zoom + cameraX;
      const sy = p.y * zoom + cameraY;
      this.graphics.circle(sx, sy, p.size * alpha);
      this.graphics.fill({ color: p.color, alpha: alpha * 0.7 });
    }

    // Update and draw fireflies
    for (const p of this.fireflyParticles) {
      p.x += p.vx + Math.sin(this.time * 0.02 + p.life) * 0.2;
      p.y += p.vy + Math.cos(this.time * 0.015 + p.life) * 0.2;
      const alpha = (Math.sin(this.time * 0.03 + p.life * 0.1) + 1) * 0.25;

      const sx = p.x * zoom + cameraX;
      const sy = p.y * zoom + cameraY;

      if (sx > -20 && sx < window.innerWidth + 20 && sy > -20 && sy < window.innerHeight + 20) {
        this.graphics.circle(sx, sy, p.size);
        this.graphics.fill({ color: p.color, alpha });
      }
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
