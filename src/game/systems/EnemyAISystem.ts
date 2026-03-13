import { EnemyState } from '../types';
import type { Vector2 } from '../types';
import {
  TORCH_RADIUS,
  ENEMY_PATROL_SPEED,
  ENEMY_CHASE_SPEED,
  ENEMY_SEARCH_SPEED,
  ENEMY_SEARCH_DURATION,
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
} from '../constants';
import { distance, normalize, sub, randomInt } from '../utils/math';
import { PathfindingSystem } from './PathfindingSystem';
import { CollisionSystem } from './CollisionSystem';
import type { Enemy } from '../entities/Enemy';

export class EnemyAISystem {
  private collision: CollisionSystem;

  constructor(_pathfinding: PathfindingSystem, collision: CollisionSystem) {
    this.collision = collision;
  }

  update(enemy: Enemy, playerPos: Vector2, torchOn: boolean) {
    const dist = distance(enemy.position, playerPos);
    const canSeePlayer = torchOn && dist < TORCH_RADIUS;

    switch (enemy.state) {
      case EnemyState.PATROL:
        if (canSeePlayer) {
          enemy.state = EnemyState.CHASE;
          enemy.lastKnownPlayerPos = { ...playerPos };
          enemy.path = null;
        } else {
          this.patrol(enemy);
        }
        break;

      case EnemyState.CHASE:
        if (canSeePlayer) {
          enemy.lastKnownPlayerPos = { ...playerPos };
          this.moveToward(enemy, playerPos, ENEMY_CHASE_SPEED);
        } else {
          enemy.state = EnemyState.SEARCH;
          enemy.searchTimer = ENEMY_SEARCH_DURATION;
          enemy.path = null;
        }
        break;

      case EnemyState.SEARCH:
        enemy.searchTimer--;
        if (canSeePlayer) {
          enemy.state = EnemyState.CHASE;
          enemy.lastKnownPlayerPos = { ...playerPos };
          enemy.path = null;
        } else if (enemy.searchTimer <= 0) {
          enemy.state = EnemyState.RETURN;
          enemy.path = null;
        } else if (enemy.lastKnownPlayerPos) {
          if (distance(enemy.position, enemy.lastKnownPlayerPos) < 20) {
            // Wander around last known position
            this.wanderAround(enemy, enemy.lastKnownPlayerPos, 100, ENEMY_SEARCH_SPEED);
          } else {
            this.moveToward(enemy, enemy.lastKnownPlayerPos, ENEMY_SEARCH_SPEED);
          }
        }
        break;

      case EnemyState.RETURN:
        if (canSeePlayer) {
          enemy.state = EnemyState.CHASE;
          enemy.lastKnownPlayerPos = { ...playerPos };
          enemy.path = null;
        } else {
          if (distance(enemy.position, enemy.patrolOrigin) < 30) {
            enemy.state = EnemyState.PATROL;
            enemy.path = null;
          } else {
            this.moveToward(enemy, enemy.patrolOrigin, ENEMY_PATROL_SPEED);
          }
        }
        break;
    }
  }

  private patrol(enemy: Enemy) {
    if (!enemy.patrolTarget || distance(enemy.position, enemy.patrolTarget) < 20) {
      enemy.patrolTarget = this.randomWalkableNear(enemy.patrolOrigin, 150);
    }
    if (enemy.patrolTarget) {
      this.moveToward(enemy, enemy.patrolTarget, ENEMY_PATROL_SPEED);
    }
  }

  private wanderAround(enemy: Enemy, center: Vector2, radius: number, speed: number) {
    if (!enemy.patrolTarget || distance(enemy.position, enemy.patrolTarget) < 20) {
      enemy.patrolTarget = this.randomWalkableNear(center, radius);
    }
    if (enemy.patrolTarget) {
      this.moveToward(enemy, enemy.patrolTarget, speed);
    }
  }

  private moveToward(enemy: Enemy, target: Vector2, speed: number) {
    const dir = normalize(sub(target, enemy.position));
    const newX = enemy.position.x + dir.x * speed;
    const newY = enemy.position.y + dir.y * speed;

    if (this.collision.canMoveTo(newX, newY, 10)) {
      enemy.position.x = newX;
      enemy.position.y = newY;
    } else if (this.collision.canMoveTo(newX, enemy.position.y, 10)) {
      enemy.position.x = newX;
    } else if (this.collision.canMoveTo(enemy.position.x, newY, 10)) {
      enemy.position.y = newY;
    }

    if (dir.x !== 0 || dir.y !== 0) {
      enemy.facing = { x: dir.x, y: dir.y };
    }
  }

  private randomWalkableNear(center: Vector2, radius: number): Vector2 | null {
    for (let attempts = 0; attempts < 20; attempts++) {
      const x = center.x + randomInt(-radius, radius);
      const y = center.y + randomInt(-radius, radius);
      const tileX = Math.floor(x / TILE_SIZE);
      const tileY = Math.floor(y / TILE_SIZE);
      if (tileX >= 0 && tileX < MAP_WIDTH && tileY >= 0 && tileY < MAP_HEIGHT) {
        if (this.collision.isTileWalkable(tileX, tileY)) {
          return { x, y };
        }
      }
    }
    return null;
  }
}
