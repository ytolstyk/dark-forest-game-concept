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
  private leftLeg: Graphics;
  private rightLeg: Graphics;
  private walkPhase = 0;
  private prevSin = 0;

  onFootstep?: (foot: 'left' | 'right') => void;

  constructor(x: number, y: number) {
    this.position = { x, y };
    this.container = new Container();

    this.leftLeg = new Graphics();
    this.rightLeg = new Graphics();
    this.body = new Graphics();

    this.drawLegs(0, 0);
    this.drawBody();

    // Legs behind body
    this.container.addChild(this.leftLeg);
    this.container.addChild(this.rightLeg);
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
  }

  private drawLegs(leftYOffset: number, rightYOffset: number) {
    this.leftLeg.clear();
    this.leftLeg.rect(-6, 16 + leftYOffset, 5, 8);
    this.leftLeg.fill(0x3a3a3a);

    this.rightLeg.clear();
    this.rightLeg.rect(1, 16 + rightYOffset, 5, 8);
    this.rightLeg.fill(0x3a3a3a);
  }

  getMovement(moveX: number, moveY: number): Vector2 {
    if (moveX === 0 && moveY === 0) return { x: 0, y: 0 };
    const dir = normalize({ x: moveX, y: moveY });
    this.facing = { x: dir.x, y: dir.y };
    return { x: dir.x * PLAYER_SPEED, y: dir.y * PLAYER_SPEED };
  }

  update(isMoving: boolean) {
    if (isMoving) {
      this.walkPhase += 0.18;
      const currSin = Math.sin(this.walkPhase);

      const leftOffset = currSin * 4;
      const rightOffset = -currSin * 4;
      this.drawLegs(leftOffset, rightOffset);

      // Detect foot-strike moments (zero crossings)
      if (this.prevSin < 0 && currSin >= 0) {
        this.onFootstep?.('left');
      } else if (this.prevSin > 0 && currSin <= 0) {
        this.onFootstep?.('right');
      }
      this.prevSin = currSin;
    } else {
      this.drawLegs(0, 0);
      this.prevSin = 0;
    }
  }

  updateVisual() {
    this.container.x = this.position.x;
    this.container.y = this.position.y;
  }
}
