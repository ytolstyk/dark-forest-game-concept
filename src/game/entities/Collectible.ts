import { Graphics, Container } from 'pixi.js';
import { COLORS } from '../constants';
import { CollectibleType } from '../types';
import type { Vector2 } from '../types';

export class Collectible {
  container: Container;
  position: Vector2;
  type: CollectibleType;
  collected = false;

  private sprite: Graphics;
  private glowGraphic: Graphics;
  private time = 0;

  constructor(x: number, y: number, type: CollectibleType) {
    this.position = { x, y };
    this.type = type;
    this.container = new Container();

    this.glowGraphic = new Graphics();
    this.sprite = new Graphics();

    this.container.addChild(this.glowGraphic);
    this.container.addChild(this.sprite);

    this.drawSprite();
    this.container.x = x;
    this.container.y = y;
  }

  private drawSprite() {
    this.sprite.clear();

    switch (this.type) {
      case CollectibleType.CAR:
        // Top-down car shape
        this.sprite.roundRect(-24, -16, 48, 32, 4);
        this.sprite.fill(COLORS.CAR_COLOR);
        // Windshield
        this.sprite.rect(-18, -12, 16, 24);
        this.sprite.fill({ color: 0x88bbdd, alpha: 0.7 });
        // Wheels
        this.sprite.rect(-26, -12, 4, 8);
        this.sprite.fill(0x222222);
        this.sprite.rect(-26, 4, 4, 8);
        this.sprite.fill(0x222222);
        this.sprite.rect(22, -12, 4, 8);
        this.sprite.fill(0x222222);
        this.sprite.rect(22, 4, 4, 8);
        this.sprite.fill(0x222222);
        break;

      case CollectibleType.KEYS:
        // Key shape
        this.sprite.circle(0, -4, 6);
        this.sprite.fill(COLORS.KEY_COLOR);
        this.sprite.circle(0, -4, 3);
        this.sprite.cut();
        this.sprite.rect(-1.5, 2, 3, 12);
        this.sprite.fill(COLORS.KEY_COLOR);
        this.sprite.rect(-1.5, 10, 6, 3);
        this.sprite.fill(COLORS.KEY_COLOR);
        break;

      case CollectibleType.FUEL:
        // Fuel canister
        this.sprite.roundRect(-8, -10, 16, 20, 2);
        this.sprite.fill(COLORS.FUEL_COLOR);
        this.sprite.rect(-3, -14, 6, 4);
        this.sprite.fill(0x888888);
        // Label
        this.sprite.rect(-5, -4, 10, 8);
        this.sprite.fill({ color: 0xffffff, alpha: 0.3 });
        break;
    }
  }

  update() {
    if (this.collected) return;
    this.time++;

    // Pulsing glow
    const glowAlpha = 0.3 + Math.sin(this.time * 0.05) * 0.2;
    const glowRadius = this.type === CollectibleType.CAR ? 35 : 20;

    this.glowGraphic.clear();
    this.glowGraphic.circle(0, 0, glowRadius);

    const color =
      this.type === CollectibleType.CAR
        ? COLORS.CAR_COLOR
        : this.type === CollectibleType.KEYS
          ? COLORS.KEY_COLOR
          : COLORS.FUEL_COLOR;
    this.glowGraphic.fill({ color, alpha: glowAlpha });
  }

  getGlowColor(): number {
    switch (this.type) {
      case CollectibleType.CAR:
        return COLORS.CAR_COLOR;
      case CollectibleType.KEYS:
        return COLORS.KEY_COLOR;
      case CollectibleType.FUEL:
        return COLORS.FUEL_COLOR;
    }
  }

  getCollisionRadius(): number {
    return this.type === CollectibleType.CAR ? 48 : 28;
  }
}
