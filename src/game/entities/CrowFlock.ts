import { Graphics, Container } from 'pixi.js';
import type { Vector2 } from '../types';
import { TORCH_RADIUS } from '../constants';

interface Crow {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wingPhase: number;
  wingSpeed: number;
  removed: boolean;
}

export class CrowFlock {
  container: Container;
  position: Vector2;
  state: 'perched' | 'scattered' = 'perched';

  private crows: Crow[] = [];
  private gfx: Graphics;

  static readonly SCATTER_RADIUS = TORCH_RADIUS * 0.3; // 120px

  constructor(x: number, y: number) {
    this.position = { x, y };
    this.container = new Container();
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);

    const count = 4 + Math.floor(Math.random() * 5); // 4–8 crows per flock
    for (let i = 0; i < count; i++) {
      this.crows.push({
        x: x + (Math.random() - 0.5) * 52,
        y: y + (Math.random() - 0.5) * 36,
        vx: 0,
        vy: 0,
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: 0.14 + Math.random() * 0.1,
        removed: false,
      });
    }
  }

  scatter() {
    if (this.state === 'scattered') return;
    this.state = 'scattered';

    for (const crow of this.crows) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 2;
      crow.vx = Math.cos(angle) * speed;
      crow.vy = Math.sin(angle) * speed;
    }
  }

  /** Update all crows. Returns true when the flock can be fully removed. */
  update(playerPos: Vector2): boolean {
    this.gfx.clear();

    const flying = this.state === 'scattered';
    let hasVisible = false;

    for (const crow of this.crows) {
      if (crow.removed) continue;

      if (flying) {
        crow.x += crow.vx;
        crow.y += crow.vy;

        // Remove once far enough from the player to be off-screen
        const dx = crow.x - playerPos.x;
        const dy = crow.y - playerPos.y;
        if (dx * dx + dy * dy > 1400 * 1400) {
          crow.removed = true;
          continue;
        }
      }

      hasVisible = true;
      crow.wingPhase += flying ? crow.wingSpeed : 0.022;
      this.drawCrow(crow, flying);
    }

    return flying && !hasVisible;
  }

  private drawCrow(crow: Crow, flying: boolean) {
    const flap = Math.sin(crow.wingPhase) * (flying ? 16.5 : 3.6);
    const { x, y } = crow;

    // Left wing triangle
    this.gfx.moveTo(x, y);
    this.gfx.lineTo(x - 27, y - flap - 3);
    this.gfx.lineTo(x - 12, y + 7.5);
    this.gfx.closePath();
    this.gfx.fill({ color: 0x0d0d0d });

    // Right wing triangle
    this.gfx.moveTo(x, y);
    this.gfx.lineTo(x + 27, y - flap - 3);
    this.gfx.lineTo(x + 12, y + 7.5);
    this.gfx.closePath();
    this.gfx.fill({ color: 0x0d0d0d });

    // Body
    this.gfx.ellipse(x, y, 10.5, 7.5);
    this.gfx.fill({ color: 0x0a0a0a });

    // Head
    this.gfx.circle(x - 9, y - 4.5, 6);
    this.gfx.fill({ color: 0x0a0a0a });
  }
}
