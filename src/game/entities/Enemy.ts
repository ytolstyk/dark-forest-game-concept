import { Graphics, Container } from 'pixi.js';
import { COLORS } from '../constants';
import { EnemyState } from '../types';
import type { Vector2 } from '../types';

export class Enemy {
  container: Container;
  position: Vector2;
  state: EnemyState = EnemyState.PATROL;
  facing: Vector2 = { x: 0, y: 1 };
  patrolOrigin: Vector2;
  patrolTarget: Vector2 | null = null;
  lastKnownPlayerPos: Vector2 | null = null;
  searchTimer = 0;
  path: Vector2[] | null = null;

  private body: Graphics;
  private leftEye: Graphics;
  private rightEye: Graphics;

  constructor(x: number, y: number) {
    this.position = { x, y };
    this.patrolOrigin = { x, y };
    this.container = new Container();

    this.body = new Graphics();
    this.leftEye = new Graphics();
    this.rightEye = new Graphics();

    this.drawBody();
    this.drawEyes();

    this.container.addChild(this.body);
    this.container.addChild(this.leftEye);
    this.container.addChild(this.rightEye);
  }

  private drawBody() {
    this.body.clear();
    // Dark shadowy body
    this.body.circle(0, 0, 12);
    this.body.fill({ color: COLORS.ENEMY_BODY, alpha: 0.8 });
    this.body.ellipse(0, 4, 10, 14);
    this.body.fill({ color: COLORS.ENEMY_BODY, alpha: 0.6 });
  }

  private drawEyes() {
    this.leftEye.clear();
    this.leftEye.circle(0, 0, 2.5);
    this.leftEye.fill(COLORS.ENEMY_EYES);

    this.rightEye.clear();
    this.rightEye.circle(0, 0, 2.5);
    this.rightEye.fill(COLORS.ENEMY_EYES);
  }

  updateVisual() {
    this.container.x = this.position.x;
    this.container.y = this.position.y;

    // Position eyes based on facing direction
    const eyeSpread = 5;
    const eyeForward = 6;

    if (Math.abs(this.facing.x) > Math.abs(this.facing.y)) {
      // Facing left/right
      const dir = this.facing.x > 0 ? 1 : -1;
      this.leftEye.x = eyeForward * dir;
      this.leftEye.y = -eyeSpread / 2;
      this.rightEye.x = eyeForward * dir;
      this.rightEye.y = eyeSpread / 2;
    } else {
      // Facing up/down
      const dir = this.facing.y > 0 ? 1 : -1;
      this.leftEye.x = -eyeSpread / 2;
      this.leftEye.y = eyeForward * dir;
      this.rightEye.x = eyeSpread / 2;
      this.rightEye.y = eyeForward * dir;
    }
  }

  getEyeWorldPositions(): [Vector2, Vector2] {
    return [
      { x: this.position.x + this.leftEye.x, y: this.position.y + this.leftEye.y },
      { x: this.position.x + this.rightEye.x, y: this.position.y + this.rightEye.y },
    ];
  }
}
