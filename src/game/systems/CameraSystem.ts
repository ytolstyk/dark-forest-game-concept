import { Container } from 'pixi.js';
import type { Vector2 } from '../types';
import { CAMERA_LERP, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT } from '../constants';
import { lerp, clamp } from '../utils/math';

export class CameraSystem {
  x = 0;
  y = 0;

  update(target: Vector2, screenWidth: number, screenHeight: number, zoom: number) {
    const targetX = -target.x * zoom + screenWidth / 2;
    const targetY = -target.y * zoom + screenHeight / 2;

    this.x = lerp(this.x, targetX, CAMERA_LERP);
    this.y = lerp(this.y, targetY, CAMERA_LERP);

    // Clamp to map bounds
    this.x = clamp(this.x, screenWidth - MAP_PIXEL_WIDTH * zoom, 0);
    this.y = clamp(this.y, screenHeight - MAP_PIXEL_HEIGHT * zoom, 0);
  }

  apply(container: Container, zoom: number) {
    container.x = this.x;
    container.y = this.y;
    container.scale.set(zoom);
  }
}
