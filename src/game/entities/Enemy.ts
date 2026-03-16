import { Graphics, Container } from 'pixi.js';
import { COLORS } from '../constants';
import { EnemyState, EnemyType } from '../types';
import type { Vector2 } from '../types';

export class Enemy {
  container: Container;
  position: Vector2;
  type: EnemyType;
  state: EnemyState = EnemyState.PATROL;
  facing: Vector2 = { x: 0, y: 1 };
  patrolOrigin: Vector2;
  patrolTarget: Vector2 | null = null;
  lastKnownPlayerPos: Vector2 | null = null;
  searchTimer = 0;
  path: Vector2[] | null = null;
  // Leshen-specific: once it locks on it never lets go
  hasDetectedPlayer = false;
  pathUpdateTimer = 0;
  pathTarget: Vector2 | null = null;

  private body: Graphics;
  private leftEye: Graphics;
  private rightEye: Graphics;
  private _eyesChasing = false;

  constructor(x: number, y: number, scale = 1, type: EnemyType = EnemyType.WATCHER) {
    this.position = { x, y };
    this.patrolOrigin = { x, y };
    this.type = type;
    this.container = new Container();

    this.body = new Graphics();
    this.leftEye = new Graphics();
    this.rightEye = new Graphics();

    const eyeColor = type === EnemyType.LESHEN ? 0xff3322 : COLORS.ENEMY_EYES;
    this.drawBody();
    this.drawEyes(eyeColor);

    this.container.addChild(this.body);
    this.container.addChild(this.leftEye);
    this.container.addChild(this.rightEye);

    // Lurkers start with invisible eyes
    if (type === EnemyType.LURKER) {
      this.leftEye.visible = false;
      this.rightEye.visible = false;
    }

    this.container.scale.set(scale);
  }

  private drawBody() {
    this.body.clear();

    if (this.type === EnemyType.LESHEN) {
      // Tall imposing torso
      this.body.ellipse(0, 8, 9, 20);
      this.body.fill({ color: 0x08080f, alpha: 0.95 });
      // Wide head
      this.body.circle(0, -8, 11);
      this.body.fill({ color: 0x0d0d1a, alpha: 0.92 });
      // Left antler — two branches
      this.body.moveTo(-4, -17);
      this.body.lineTo(-13, -33);
      this.body.stroke({ color: 0x1a1a2e, width: 3 });
      this.body.moveTo(-13, -33);
      this.body.lineTo(-20, -44);
      this.body.stroke({ color: 0x1a1a2e, width: 2.5 });
      this.body.moveTo(-13, -33);
      this.body.lineTo(-7, -43);
      this.body.stroke({ color: 0x1a1a2e, width: 2 });
      // Right antler — two branches
      this.body.moveTo(4, -17);
      this.body.lineTo(13, -33);
      this.body.stroke({ color: 0x1a1a2e, width: 3 });
      this.body.moveTo(13, -33);
      this.body.lineTo(20, -44);
      this.body.stroke({ color: 0x1a1a2e, width: 2.5 });
      this.body.moveTo(13, -33);
      this.body.lineTo(7, -43);
      this.body.stroke({ color: 0x1a1a2e, width: 2 });
    } else {
      // Dark shadowy body (watcher / lurker)
      this.body.circle(0, 0, 12);
      this.body.fill({ color: COLORS.ENEMY_BODY, alpha: 0.8 });
      this.body.ellipse(0, 4, 10, 14);
      this.body.fill({ color: COLORS.ENEMY_BODY, alpha: 0.6 });
    }
  }

  private drawEyes(color: number) {
    const r = this.type === EnemyType.LESHEN ? 3.5 : 2.5;
    this.leftEye.clear();
    this.leftEye.circle(0, 0, r);
    this.leftEye.fill(color);

    this.rightEye.clear();
    this.rightEye.circle(0, 0, r);
    this.rightEye.fill(color);
  }

  updateVisual() {
    this.container.x = this.position.x;
    this.container.y = this.position.y;

    // Position eyes based on facing direction
    const eyeSpread = this.type === EnemyType.LESHEN ? 6 : 5;
    const eyeForward = this.type === EnemyType.LESHEN ? 7 : 6;
    const eyeBaseY = this.type === EnemyType.LESHEN ? -8 : 0;

    if (Math.abs(this.facing.x) > Math.abs(this.facing.y)) {
      // Facing left/right
      const dir = this.facing.x > 0 ? 1 : -1;
      this.leftEye.x = eyeForward * dir;
      this.leftEye.y = eyeBaseY - eyeSpread / 2;
      this.rightEye.x = eyeForward * dir;
      this.rightEye.y = eyeBaseY + eyeSpread / 2;
    } else {
      // Facing up/down
      const dir = this.facing.y > 0 ? 1 : -1;
      this.leftEye.x = -eyeSpread / 2;
      this.leftEye.y = eyeBaseY + eyeForward * dir;
      this.rightEye.x = eyeSpread / 2;
      this.rightEye.y = eyeBaseY + eyeForward * dir;
    }

    // Lurker: show yellow eyes only when chasing
    if (this.type === EnemyType.LURKER) {
      const isChasing = this.state === EnemyState.CHASE;
      if (isChasing !== this._eyesChasing) {
        this._eyesChasing = isChasing;
        this.leftEye.visible = isChasing;
        this.rightEye.visible = isChasing;
        if (isChasing) {
          this.drawEyes(0xffff00);
        }
      }
    }

    // Leshen: eyes pulse brighter red once locked on
    if (this.type === EnemyType.LESHEN && this.hasDetectedPlayer) {
      const pulse = 0.7 + Math.sin(Date.now() * 0.006) * 0.3;
      this.leftEye.alpha = pulse;
      this.rightEye.alpha = pulse;
    }
  }

  getEyeWorldPositions(): [Vector2, Vector2] {
    return [
      { x: this.position.x + this.leftEye.x, y: this.position.y + this.leftEye.y },
      { x: this.position.x + this.rightEye.x, y: this.position.y + this.rightEye.y },
    ];
  }
}
