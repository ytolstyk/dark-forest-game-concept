import { EnemyState } from '../types';
import type { Vector2 } from '../types';
import {
  TORCH_RADIUS,
  LURKER_HEAR_RADIUS,
  ENEMY_PATROL_SPEED,
  ENEMY_CHASE_SPEED,
  LURKER_CHASE_SPEED,
  ENEMY_SEARCH_SPEED,
  ENEMY_SEARCH_DURATION,
  LESHEN_SPEED,
  LESHEN_PATROL_RADIUS,
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
} from '../constants';
import { EnemyType } from '../types';
import { distance, normalize, sub, randomInt } from '../utils/math';
import { PathfindingSystem } from './PathfindingSystem';
import { CollisionSystem } from './CollisionSystem';
import type { Enemy } from '../entities/Enemy';

export class EnemyAISystem {
  private pathfinding: PathfindingSystem;
  private collision: CollisionSystem;

  constructor(pathfinding: PathfindingSystem, collision: CollisionSystem) {
    this.pathfinding = pathfinding;
    this.collision = collision;
  }

  update(enemy: Enemy, playerPos: Vector2, torchOn: boolean) {
    // Leshen has its own FSM — handle separately
    if (enemy.type === EnemyType.LESHEN) {
      this.updateLeshen(enemy, playerPos, torchOn);
      return;
    }

    const dist = distance(enemy.position, playerPos);

    // Watchers see the player when the torch is on; lurkers hear within half the torch radius
    const canDetectPlayer =
      enemy.type === EnemyType.LURKER
        ? dist < LURKER_HEAR_RADIUS
        : torchOn && dist < TORCH_RADIUS;

    // Local alias so the rest of the switch is unchanged
    const canSeePlayer = canDetectPlayer;

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

      case EnemyState.CHASE: {
        const chaseSpeed = enemy.type === EnemyType.LURKER ? LURKER_CHASE_SPEED : ENEMY_CHASE_SPEED;
        if (canSeePlayer) {
          enemy.lastKnownPlayerPos = { ...playerPos };
          this.moveToward(enemy, playerPos, chaseSpeed);
        } else {
          enemy.state = EnemyState.SEARCH;
          enemy.searchTimer = ENEMY_SEARCH_DURATION;
          enemy.path = null;
        }
        break;
      }

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

  private updateLeshen(enemy: Enemy, playerPos: Vector2, torchOn: boolean) {
    const dist = distance(enemy.position, playerPos);

    // Detection: torch visible OR within hearing range
    const canDetect = (torchOn && dist < TORCH_RADIUS) || dist < LURKER_HEAR_RADIUS;

    if (canDetect && !enemy.hasDetectedPlayer) {
      enemy.hasDetectedPlayer = true;
      enemy.state = EnemyState.CHASE;
      enemy.path = null;
      enemy.pathUpdateTimer = 0;
    }

    if (!enemy.hasDetectedPlayer) {
      // Still patrolling — roam a large area of the map
      this.wanderAround(enemy, enemy.patrolOrigin, LESHEN_PATROL_RADIUS, ENEMY_PATROL_SPEED);
      return;
    }

    // Permanently chasing — use A* to navigate around obstacles
    enemy.state = EnemyState.CHASE;

    const playerMovedFar =
      !enemy.pathTarget || distance(playerPos, enemy.pathTarget) > TILE_SIZE * 2;

    if (!enemy.path || enemy.path.length === 0 || playerMovedFar) {
      const found = this.pathfinding.findPath(enemy.position, playerPos);
      enemy.path = found ?? null;
      enemy.pathTarget = { ...playerPos };
    }

    if (enemy.path && enemy.path.length > 0) {
      const next = enemy.path[0];
      if (distance(enemy.position, next) < LESHEN_SPEED + 4) {
        enemy.path.shift();
      } else {
        this.moveToward(enemy, next, LESHEN_SPEED);
      }
    } else {
      // Fallback: direct movement if no path found
      this.moveToward(enemy, playerPos, LESHEN_SPEED);
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
    const needsNewTarget = !enemy.patrolTarget || distance(enemy.position, enemy.patrolTarget) < 20;

    // Stuck detection: every 90 frames check if we've moved at least 8px
    enemy.stuckTimer++;
    if (enemy.stuckTimer >= 90) {
      enemy.stuckTimer = 0;
      const prev = enemy.lastStuckCheckPos;
      if (prev && distance(enemy.position, prev) < 8) {
        // Stuck — force a new waypoint
        enemy.patrolTarget = null;
      }
      enemy.lastStuckCheckPos = { ...enemy.position };
    }

    if (needsNewTarget || !enemy.patrolTarget) {
      // Try the full radius first, fall back to a small area near current position
      enemy.patrolTarget =
        this.randomWalkableNear(center, radius) ??
        this.randomWalkableNear(enemy.position, TILE_SIZE * 6);
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
    const EDGE_MARGIN = 5; // tiles to keep away from map edge
    for (let attempts = 0; attempts < 50; attempts++) {
      const x = center.x + randomInt(-radius, radius);
      const y = center.y + randomInt(-radius, radius);
      const tileX = Math.floor(x / TILE_SIZE);
      const tileY = Math.floor(y / TILE_SIZE);
      if (
        tileX >= EDGE_MARGIN &&
        tileX < MAP_WIDTH - EDGE_MARGIN &&
        tileY >= EDGE_MARGIN &&
        tileY < MAP_HEIGHT - EDGE_MARGIN &&
        this.collision.isTileWalkable(tileX, tileY)
      ) {
        return { x, y };
      }
    }
    return null;
  }
}
