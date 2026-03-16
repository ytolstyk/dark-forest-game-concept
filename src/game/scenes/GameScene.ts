import { Application, Container, Graphics } from 'pixi.js';
import { GameState, EnemyState, EnemyType, CollectibleType, TileType } from '../types';
import { MAX_HEAR_DISTANCE, LESHEN_GLOW_COLOR, LESHEN_GLOW_RADIUS } from '../constants';
import { distance } from '../utils/math';
import { generateMap } from '../map/MapGenerator';
import { TileMap } from '../map/TileMap';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Collectible } from '../entities/Collectible';
import { InputSystem } from '../systems/InputSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { EnemyAISystem } from '../systems/EnemyAISystem';
import { PathfindingSystem } from '../systems/PathfindingSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { ParticleEffects } from '../assets/ParticleEffects';

export class GameScene {
  private app: Application;
  private onStateChange: (state: string) => void;

  private worldContainer: Container;
  private entityContainer: Container;

  private tileMap: TileMap;
  private tiles: TileType[][] = [];
  private player!: Player;
  private enemies: Enemy[] = [];
  private collectibles: Collectible[] = [];

  input: InputSystem;
  private camera: CameraSystem;
  private collision: CollisionSystem;
  private lighting: LightingSystem;
  private enemyAI: EnemyAISystem;
  private pathfinding: PathfindingSystem;
  private audio: AudioSystem;
  private particles: ParticleEffects;

  private footstepContainer: Container;
  private footstepCount = 0;
  private readonly FOOTSTEP_MAX_COUNT = 400;

  private anyRegularChasing = false;
  private leshenChasing = false;
  private gameOver = false;

  // Expose state for React HUD
  torchOn = false;
  inventory = { keys: false, fuel: false };
  totalSteps = 0;
  heartRate = 75;
  avgHeartRate = 75;
  maxHeartRate = 75;

  // Heart rate simulation internals
  private hrFrameTimer = 0;
  private hrSampleSum = 75;
  private hrSampleCount = 1;

  constructor(app: Application, onStateChange: (state: string) => void) {
    this.app = app;
    this.onStateChange = onStateChange;

    this.worldContainer = new Container();
    this.entityContainer = new Container();

    this.footstepContainer = new Container();
    this.tileMap = new TileMap();
    this.input = new InputSystem();
    this.camera = new CameraSystem();
    this.collision = new CollisionSystem();
    this.lighting = new LightingSystem();
    this.pathfinding = new PathfindingSystem();
    this.audio = new AudioSystem();
    this.particles = new ParticleEffects();
    this.enemyAI = new EnemyAISystem(this.pathfinding, this.collision);
  }

  async init(onProgress?: (pct: number) => void) {
    this.audio.init();

    // Yield so the loading UI can paint before we start heavy work
    await new Promise<void>((r) => setTimeout(r, 50));

    const mapData = generateMap();
    this.tiles = mapData.tiles;

    // Set tiles for systems
    this.collision.setTiles(mapData.tiles);
    this.pathfinding.setTiles(mapData.tiles);

    // Render tile map (async, chunked — keeps browser responsive)
    await this.tileMap.render(mapData.tiles, onProgress);

    // Create player
    this.player = new Player(mapData.playerSpawn.x, mapData.playerSpawn.y);

    // Create enemies — ~40% lurkers, ~60% watchers
    this.enemies = [];
    for (const spawn of mapData.enemySpawns) {
      const enemyScale = 1 + Math.random(); // 1.0 – 2.0
      const type = Math.random() < 0.4 ? EnemyType.LURKER : EnemyType.WATCHER;
      this.enemies.push(new Enemy(spawn.x, spawn.y, enemyScale, type));
    }

    // Exactly one Leshen — pick a spawn far from the player
    const leshenSpawn = mapData.enemySpawns.reduce((best, s) => {
      const d = Math.hypot(s.x - mapData.playerSpawn.x, s.y - mapData.playerSpawn.y);
      const bd = Math.hypot(best.x - mapData.playerSpawn.x, best.y - mapData.playerSpawn.y);
      return d > bd ? s : best;
    }, mapData.enemySpawns[0]);
    this.enemies.push(new Enemy(leshenSpawn.x, leshenSpawn.y, 1.4, EnemyType.LESHEN));

    // Create collectibles
    this.collectibles = [
      new Collectible(mapData.carPosition.x, mapData.carPosition.y, CollectibleType.CAR),
      new Collectible(mapData.keysPosition.x, mapData.keysPosition.y, CollectibleType.KEYS),
      new Collectible(mapData.fuelPosition.x, mapData.fuelPosition.y, CollectibleType.FUEL),
    ];

    // Wire up footstep spawning
    this.player.onFootstep = (foot) => {
      this.spawnFootstep(foot);
      this.totalSteps++;
    };

    // Build scene graph: map -> footsteps -> entities -> particles -> darkness -> glow
    this.worldContainer.addChild(this.tileMap.container);
    this.worldContainer.addChild(this.footstepContainer);
    this.worldContainer.addChild(this.entityContainer);

    for (const c of this.collectibles) {
      this.entityContainer.addChild(c.container);
    }
    for (const e of this.enemies) {
      this.entityContainer.addChild(e.container);
    }
    this.entityContainer.addChild(this.player.container);

    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.particles.container);
    this.app.stage.addChild(this.lighting.getDarkness());
    this.app.stage.addChild(this.lighting.getGlowLayer());
  }

  update = () => {
    if (this.gameOver) return;

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const zoom = Math.min(screenW, screenH) < 600 ? 0.6 : screenW < 900 ? 0.75 : 1.0;

    // 1. Input
    this.input.update();

    // 2. Torch toggle
    if (this.input.justPressed('Space')) {
      this.player.torchOn = !this.player.torchOn;
      this.torchOn = this.player.torchOn;
      this.audio.updateTorch(this.player.torchOn);
    }

    // 3. Player movement
    const move = this.player.getMovement(this.input.moveX, this.input.moveY);
    const isMoving = move.x !== 0 || move.y !== 0;

    // 4. Tile collision
    const newX = this.player.position.x + move.x;
    const newY = this.player.position.y + move.y;

    // Hitbox is centered at the legs (y+20 from sprite origin), radius 6
    const legOffsetY = 20;
    const hitRadius = 6;
    if (this.collision.canMoveTo(newX, newY + legOffsetY, hitRadius)) {
      this.player.position.x = newX;
      this.player.position.y = newY;
    } else if (this.collision.canMoveTo(newX, this.player.position.y + legOffsetY, hitRadius)) {
      this.player.position.x = newX;
    } else if (this.collision.canMoveTo(this.player.position.x, newY + legOffsetY, hitRadius)) {
      this.player.position.y = newY;
    }

    // 5. Enemy AI
    let regularChasing = false;
    let closestEnemyDist = Infinity;

    for (const enemy of this.enemies) {
      this.enemyAI.update(enemy, this.player.position, this.player.torchOn);
      enemy.updateVisual();

      const dist = distance(enemy.position, this.player.position);
      if (dist < closestEnemyDist) closestEnemyDist = dist;

      if (enemy.state === EnemyState.CHASE && enemy.type !== EnemyType.LESHEN) {
        regularChasing = true;
      }

      // 6. Enemy-player collision (death)
      if (this.collision.circleCollision(enemy.position, 12, this.player.position, 8)) {
        this.handleDeath();
        return;
      }
    }

    // Regular enemy chase sound
    if (regularChasing && !this.anyRegularChasing) {
      this.audio.startRegularChaseSound();
    } else if (!regularChasing && this.anyRegularChasing) {
      this.audio.stopRegularChaseSound();
    }
    this.anyRegularChasing = regularChasing;

    // Leshen growl + chase music — plays whenever the Leshen has locked on
    const leshen = this.enemies.find((e) => e.type === EnemyType.LESHEN);
    const leshenNowChasing = !!leshen?.hasDetectedPlayer;
    if (leshenNowChasing && !this.leshenChasing) {
      this.audio.playLeshenDetectGrowl();
      this.audio.startLeshenGrowl();
      this.audio.startChaseMusic();
    } else if (!leshenNowChasing && this.leshenChasing) {
      this.audio.stopLeshenGrowl();
      this.audio.stopChaseMusic();
    }
    this.leshenChasing = leshenNowChasing;

    // Drive Leshen chase music volume by distance to Leshen
    if (leshenNowChasing && leshen) {
      this.audio.updateLeshenChaseVolume(distance(leshen.position, this.player.position));
    }

    // 7. Collectible interactions
    for (const c of this.collectibles) {
      if (c.collected) continue;
      c.update();

      const dist = distance(this.player.position, c.position);
      if (dist < c.getCollisionRadius()) {
        if (c.type === CollectibleType.CAR) {
          if (this.player.inventory.keys && this.player.inventory.fuel) {
            c.collected = true;
            c.container.visible = false;
            this.handleWin();
            return;
          }
        } else {
          c.collected = true;
          c.container.visible = false;
          if (c.type === CollectibleType.KEYS) this.player.inventory.keys = true;
          if (c.type === CollectibleType.FUEL) this.player.inventory.fuel = true;
          this.inventory = { ...this.player.inventory };
          this.audio.playPickup();
        }
      }
    }

    // 8. Update player (leg animation + footstep callbacks)
    this.player.update(isMoving);
    this.player.updateVisual();


    // 8b. Heart rate simulation (ticks once per second at ~60 fps)
    this.hrFrameTimer++;
    if (this.hrFrameTimer >= 60) {
      this.hrFrameTimer = 0;
      this.updateHeartRate(isMoving, closestEnemyDist);
    }

    // 9. Camera
    this.camera.update(this.player.position, screenW, screenH, zoom);
    this.camera.apply(this.worldContainer, zoom);

    // 10. Particles
    this.particles.update(this.player.position, this.player.torchOn, this.camera.x, this.camera.y, zoom);

    // 11. Lighting
    const enemyGlows: { position: { x: number; y: number }; color: number; radius: number; alpha: number }[] = [];
    for (const enemy of this.enemies) {
      if (enemy.type === EnemyType.WATCHER) {
        // Watchers always have green glowing eyes
        const [left, right] = enemy.getEyeWorldPositions();
        const glowAlpha = enemy.state === EnemyState.CHASE ? 0.9 : 0.6;
        enemyGlows.push({ position: left, color: 0xaaff44, radius: 3, alpha: glowAlpha });
        enemyGlows.push({ position: right, color: 0xaaff44, radius: 3, alpha: glowAlpha });
      } else if (enemy.type === EnemyType.LURKER && enemy.state === EnemyState.CHASE) {
        // Lurkers only glow yellow when actively chasing
        const [left, right] = enemy.getEyeWorldPositions();
        enemyGlows.push({ position: left, color: 0xffff00, radius: 3, alpha: 0.9 });
        enemyGlows.push({ position: right, color: 0xffff00, radius: 3, alpha: 0.9 });
      } else if (enemy.type === EnemyType.LESHEN) {
        // Leshen: faint body aura always present, intensifies once locked on
        const bodyAlpha = enemy.hasDetectedPlayer ? 0.22 : 0.08;
        const bodyRadius = enemy.hasDetectedPlayer
          ? LESHEN_GLOW_RADIUS
          : LESHEN_GLOW_RADIUS * 0.6;
        enemyGlows.push({ position: enemy.position, color: LESHEN_GLOW_COLOR, radius: bodyRadius, alpha: bodyAlpha });
        // Red eye glow
        const [left, right] = enemy.getEyeWorldPositions();
        const eyeAlpha = enemy.hasDetectedPlayer ? 0.85 : 0.4;
        enemyGlows.push({ position: left, color: 0xff3322, radius: 4, alpha: eyeAlpha });
        enemyGlows.push({ position: right, color: 0xff3322, radius: 4, alpha: eyeAlpha });
      }
    }

    const itemGlows: { position: { x: number; y: number }; color: number; radius: number; alpha: number }[] = [];
    for (const c of this.collectibles) {
      if (!c.collected) {
        const pulseAlpha = 0.3 + Math.sin(Date.now() * 0.003) * 0.15;
        itemGlows.push({
          position: c.position,
          color: c.getGlowColor(),
          radius: c.type === CollectibleType.CAR ? 8 : 5,
          alpha: pulseAlpha,
        });
      }
    }

    this.lighting.update(
      this.player.position,
      this.player.torchOn,
      this.camera.x,
      this.camera.y,
      screenW,
      screenH,
      this.tiles,
      enemyGlows,
      itemGlows,
      zoom,
    );

    // 12. Audio
    this.audio.updateFootsteps(isMoving);
    this.audio.updateEnemyGrowl(closestEnemyDist, MAX_HEAR_DISTANCE);
  };

  private spawnFootstep(foot: 'left' | 'right') {
    const side = foot === 'left' ? -1 : 1;
    // Offset perpendicular to facing direction
    const perpX = -this.player.facing.y * side * 4;
    const perpY = this.player.facing.x * side * 4;

    const g = new Graphics();
    g.ellipse(0, 0, 2.5, 4);
    g.fill(0x111108);
    g.x = this.player.position.x + perpX;
    g.y = this.player.position.y + perpY + 18;
    g.rotation = Math.atan2(this.player.facing.y, this.player.facing.x) + Math.PI / 2;
    g.alpha = 0.45;

    this.footstepContainer.addChild(g);
    this.footstepCount++;

    // Evict oldest if over cap
    if (this.footstepCount > this.FOOTSTEP_MAX_COUNT) {
      const old = this.footstepContainer.children[0];
      if (old) this.footstepContainer.removeChildAt(0).destroy();
      this.footstepCount--;
    }
  }

  private updateHeartRate(isMoving: boolean, closestEnemyDist: number) {
    // Base target from movement state
    const baseLow = isMoving ? 90 : 60;
    const baseHigh = isMoving ? 130 : 90;
    let target = baseLow + Math.random() * (baseHigh - baseLow);

    // Enemy proximity bonus — scales from 0 at 600 px to full at 80 px
    const ENEMY_MAX_DIST = 600;
    const ENEMY_MIN_DIST = 80;
    if (closestEnemyDist < ENEMY_MAX_DIST) {
      const t = 1 - Math.min(1, Math.max(0, (closestEnemyDist - ENEMY_MIN_DIST) / (ENEMY_MAX_DIST - ENEMY_MIN_DIST)));
      target = target + t * (185 - target);
    }

    // Max drift per second: 15 bpm
    const maxDelta = 15;
    const delta = Math.max(-maxDelta, Math.min(maxDelta, target - this.heartRate));
    this.heartRate = Math.round(Math.max(60, Math.min(185, this.heartRate + delta)));

    // Running stats
    this.hrSampleSum += this.heartRate;
    this.hrSampleCount++;
    this.avgHeartRate = Math.round(this.hrSampleSum / this.hrSampleCount);
    if (this.heartRate > this.maxHeartRate) this.maxHeartRate = this.heartRate;
  }

  private handleDeath() {
    this.gameOver = true;
    this.audio.stopAll();
    this.audio.playDeath();
    this.onStateChange(GameState.GAME_OVER);
  }

  private handleWin() {
    this.gameOver = true;
    this.audio.stopAll();
    this.audio.playWin();
    this.onStateChange(GameState.WIN);
  }

  destroy() {
    this.gameOver = true;
    this.audio.destroy();
    this.tileMap.destroy();
    this.particles.destroy();
    this.lighting.destroy();
    this.worldContainer.destroy({ children: true });
    this.app.stage.removeChildren();
  }
}
