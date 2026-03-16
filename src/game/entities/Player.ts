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
  private leftArm: Graphics;
  private torchArm: Graphics;
  private walkPhase = 0;
  private prevSin = 0;
  private flamePhase = 0;

  onFootstep?: (foot: 'left' | 'right') => void;

  constructor(x: number, y: number) {
    this.position = { x, y };
    this.container = new Container();

    this.leftLeg = new Graphics();
    this.rightLeg = new Graphics();
    this.body = new Graphics();
    this.leftArm = new Graphics();
    this.torchArm = new Graphics();

    this.drawLegs(0, 0);
    this.drawBody();

    // Legs behind body, arms in front
    this.container.addChild(this.leftLeg);
    this.container.addChild(this.rightLeg);
    this.container.addChild(this.body);
    this.container.addChild(this.leftArm);
    this.container.addChild(this.torchArm);
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

  // Sleeve + hand stub snug against the left body edge (x=-8)
  private drawLeftArm(swing: number) {
    this.leftArm.clear();
    // Sleeve (shirt color), inner portion overlaps body edge
    this.leftArm.roundRect(-13, 1 + swing, 6, 6, 2);
    this.leftArm.fill(COLORS.PLAYER_SHIRT);
    // Hand (skin), small nub at the outer tip
    this.leftArm.roundRect(-14, 3 + swing, 3, 3, 1);
    this.leftArm.fill(COLORS.PLAYER_BODY);
  }

  // Compact right arm with no torch — sleeve + hand snug against right body edge (x=8)
  private drawRightArm(swing: number) {
    this.torchArm.clear();
    // Sleeve
    this.torchArm.roundRect(7, 1 + swing, 6, 6, 2);
    this.torchArm.fill(COLORS.PLAYER_SHIRT);
    // Hand
    this.torchArm.roundRect(11, 3 + swing, 3, 3, 1);
    this.torchArm.fill(COLORS.PLAYER_BODY);
  }

  // Extended right arm holding a torch
  private drawTorchArm(swing: number) {
    this.torchArm.clear();

    // Sleeve — longer to reach the torch handle
    this.torchArm.roundRect(7, 1 + swing, 9, 5, 2);
    this.torchArm.fill(COLORS.PLAYER_SHIRT);
    // Hand / wrist at the outer end
    this.torchArm.roundRect(14, 3 + swing, 3, 3, 1);
    this.torchArm.fill(COLORS.PLAYER_BODY);

    // Torch stick
    const stickX = 15;
    const stickTopY = -14 + swing;
    this.torchArm.rect(stickX, stickTopY + 4, 3, 12);
    this.torchArm.fill(0x7a5c2a);

    // Torch head wrap (dark cloth)
    this.torchArm.rect(stickX - 1, stickTopY, 5, 5);
    this.torchArm.fill(0x2a1a08);

    // Animated flame layers
    const f1 = Math.sin(this.flamePhase) * 0.25 + 0.75;
    const f2 = Math.sin(this.flamePhase * 1.7 + 1.0) * 0.2 + 0.8;
    const f3 = Math.sin(this.flamePhase * 2.3 + 2.1) * 0.15 + 0.85;

    const cx = stickX + 1.5;
    const baseY = stickTopY - 1;

    // Outer glow (orange)
    this.torchArm.ellipse(cx, baseY - 5 * f1, 4.5 * f2, 8 * f1);
    this.torchArm.fill({ color: COLORS.TORCH_OUTER, alpha: 0.85 });
    // Mid flame
    this.torchArm.ellipse(cx, baseY - 4 * f2, 3 * f3, 6 * f2);
    this.torchArm.fill(COLORS.TORCH_INNER);
    // Inner core
    this.torchArm.ellipse(cx, baseY - 2.5 * f3, 1.8, 4 * f3 * 0.7);
    this.torchArm.fill(0xffee88);
    // Hot tip
    this.torchArm.ellipse(cx, baseY - 2 * f1, 0.9, 2);
    this.torchArm.fill(0xffffff);
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

    const armSwing = isMoving ? Math.sin(this.walkPhase) * 2.5 : 0;
    this.drawLeftArm(-armSwing);
    if (this.torchOn) {
      this.flamePhase += 0.14;
      this.drawTorchArm(armSwing);
    } else {
      this.drawRightArm(armSwing);
    }
  }

  updateVisual() {
    this.container.x = this.position.x;
    this.container.y = this.position.y;
  }
}
