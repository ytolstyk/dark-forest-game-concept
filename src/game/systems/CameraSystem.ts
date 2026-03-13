import { Container } from 'pixi.js';
import type { Vector2 } from '../types';
import { CAMERA_LERP, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT } from '../constants';
import { lerp, clamp } from '../utils/math';

export class CameraSystem {
  x = 0;
  y = 0;

  update(target: Vector2, screenWidth: number, screenHeight: number) {
    const targetX = -target.x + screenWidth / 2;
    const targetY = -target.y + screenHeight / 2;

    this.x = lerp(this.x, targetX, CAMERA_LERP);
    this.y = lerp(this.y, targetY, CAMERA_LERP);

    // Clamp to map bounds
    this.x = clamp(this.x, -(MAP_PIXEL_WIDTH - screenWidth), 0);
    this.y = clamp(this.y, -(MAP_PIXEL_HEIGHT - screenHeight), 0);
  }

  apply(container: Container) {
    container.x = this.x;
    container.y = this.y;
  }
}
