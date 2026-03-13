import { Graphics, Container } from 'pixi.js';
import { COLORS, PLAYER_SPEED } from '../constants';
import type { Vector2, Inventory } from '../types';
import { normalize } from '../utils/math';

export class Player {
  container: Container;
  position: Vector2;
  torchOn = false;
  inventory: Inventory = { keys: false, fuel: false };
  facing: Vector2 = { x: 0, y: 1 };

  private body: Graphics;

  constructor(x: number, y: number) {
    this.position = { x, y };
    this.container = new Container();
    this.body = new Graphics();
    this.drawBody();
    this.container.addChild(this.body);
  }

  private drawBody() {
    this.body.clear();

    // Body (shirt)
    this.body.roundRect(-8, -4, 16, 20, 3);
    this.body.fill(COLORS.PLAYER_SHIRT);

    // Head
    this.body.circle(0, -8, 7);
    this.body.fill(COLORS.PLAYER_BODY);

    // Legs
    this.body.rect(-6, 16, 4, 8);
    this.body.fill(0x3a3a3a);
    this.body.rect(2, 16, 4, 8);
    this.body.fill(0x3a3a3a);
  }

  getMovement(moveX: number, moveY: number): Vector2 {
    if (moveX === 0 && moveY === 0) return { x: 0, y: 0 };
    const dir = normalize({ x: moveX, y: moveY });
    this.facing = { x: dir.x, y: dir.y };
    return { x: dir.x * PLAYER_SPEED, y: dir.y * PLAYER_SPEED };
  }

  updateVisual() {
    this.container.x = this.position.x;
    this.container.y = this.position.y;
  }
}
