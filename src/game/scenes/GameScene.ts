import { Application, Container, Graphics } from 'pixi.js';
import { GameState, EnemyState, EnemyType, CollectibleType, TileType, DEFAULT_GAME_OPTIONS } from '../types';
import type { GameOptions } from '../types';
import { MAX_HEAR_DISTANCE, LESHEN_GLOW_COLOR, LESHEN_GLOW_RADIUS, TILE_SIZE, SPIDER_WEB_SLOW } from '../constants';
import { distance } from '../utils/math';
import { generateMap } from '../map/MapGenerator';
import { TileMap } from '../map/TileMap';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Collectible } from '../entities/Collectible';
import { CrowFlock } from '../entities/CrowFlock';
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

  private crowFlocks: CrowFlock[] = [];

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
  enemiesNoticed = 0;
  crowsSpooked = 0;
  leshenSteps = 0;

  // Heart rate simulation internals
  private hrFrameTimer = 0;
  private hrSampleSum = 75;
  private hrSampleCount = 1;

  // Stat tracking internals
  private noticedEnemies = new Set<Enemy>();
  private leshenChaseAccum = 0;

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

  async init(onProgress?: (pct: number) => void, options: GameOptions = DEFAULT_GAME_OPTIONS) {
    this.audio.init(options.volume);

    // Yield so the loading UI can paint before we start heavy work
    await new Promise<void>((r) => setTimeout(r, 50));

    const mapData = generateMap(options.monsterCount);
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

    // Exactly one Leshen — pick a spawn far from the player (if enabled)
    if (options.leshenEnabled && mapData.enemySpawns.length > 0) {
      const leshenSpawn = mapData.enemySpawns.reduce((best, s) => {
        const d = Math.hypot(s.x - mapData.playerSpawn.x, s.y - mapData.playerSpawn.y);
        const bd = Math.hypot(best.x - mapData.playerSpawn.x, best.y - mapData.playerSpawn.y);
        return d > bd ? s : best;
      }, mapData.enemySpawns[0]);
      this.enemies.push(new Enemy(leshenSpawn.x, leshenSpawn.y, 1.4, EnemyType.LESHEN));
    }

    // Create collectibles
    this.collectibles = [
      new Collectible(mapData.carPosition.x, mapData.carPosition.y, CollectibleType.CAR),
      new Collectible(mapData.keysPosition.x, mapData.keysPosition.y, CollectibleType.KEYS),
      new Collectible(mapData.fuelPosition.x, mapData.fuelPosition.y, CollectibleType.FUEL),
    ];

    // Spawn crow flocks at tree tiles
    this.spawnCrowFlocks(mapData.playerSpawn.x, mapData.playerSpawn.y);

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
    for (const flock of this.crowFlocks) {
      this.entityContainer.addChild(flock.container);
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
    // Hitbox is centered at the legs (y+20 from sprite origin), radius 6
    const legOffsetY = 20;

    // Spider web: slow player to half speed
    if (isMoving) {
      const tileX = Math.floor(this.player.position.x / TILE_SIZE);
      const tileY = Math.floor((this.player.position.y + legOffsetY) / TILE_SIZE);
      if (this.tiles[tileY]?.[tileX] === TileType.SPIDER_WEB) {
        move.x *= SPIDER_WEB_SLOW;
        move.y *= SPIDER_WEB_SLOW;
      }
    }

    const newX = this.player.position.x + move.x;
    const newY = this.player.position.y + move.y;
    const hitRadius = 6;
    const prevX = this.player.position.x;
    const prevY = this.player.position.y;
    if (this.collision.canMoveTo(newX, newY + legOffsetY, hitRadius)) {
      this.player.position.x = newX;
      this.player.position.y = newY;
    } else if (this.collision.canMoveTo(newX, this.player.position.y + legOffsetY, hitRadius)) {
      this.player.position.x = newX;
    } else if (this.collision.canMoveTo(this.player.position.x, newY + legOffsetY, hitRadius)) {
      this.player.position.y = newY;
    }
    const actuallyMoved = this.player.position.x !== prevX || this.player.position.y !== prevY;

    // 5. Enemy AI
    let regularChasing = false;
    let closestEnemyDist = Infinity;

    for (const enemy of this.enemies) {
      const wasChasing = enemy.state === EnemyState.CHASE;
      const prevPos = { x: enemy.position.x, y: enemy.position.y };

      this.enemyAI.update(enemy, this.player.position, this.player.torchOn);
      enemy.updateVisual();

      // Track enemies that notice the player for the first time
      if (enemy.state === EnemyState.CHASE && !wasChasing && !this.noticedEnemies.has(enemy)) {
        this.noticedEnemies.add(enemy);
        this.enemiesNoticed++;
      }

      // Track Leshen steps (distance traveled while chasing, in tile-sized units)
      if (enemy.type === EnemyType.LESHEN && enemy.hasDetectedPlayer) {
        const dx = enemy.position.x - prevPos.x;
        const dy = enemy.position.y - prevPos.y;
        this.leshenChaseAccum += Math.sqrt(dx * dx + dy * dy);
        this.leshenSteps = Math.floor(this.leshenChaseAccum / TILE_SIZE);
      }

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
    this.player.update(actuallyMoved);
    this.player.updateVisual();


    // 8b. Crow flocks — scatter when player approaches, remove once off-screen
    this.crowFlocks = this.crowFlocks.filter((flock) => {
      if (flock.state === 'perched') {
        const dx = flock.position.x - this.player.position.x;
        const dy = flock.position.y - this.player.position.y;
        if (dx * dx + dy * dy < CrowFlock.SCATTER_RADIUS * CrowFlock.SCATTER_RADIUS) {
          flock.scatter();
          this.crowsSpooked++;
          this.audio.playCrowScatter();
          this.audio.triggerCrowFearHeartbeat();
        }
      }
      const done = flock.update(this.player.position);
      if (done) {
        this.entityContainer.removeChild(flock.container);
        flock.container.destroy({ children: true });
        return false;
      }
      return true;
    });

    // Heart rate simulation (ticks once per second at ~60 fps)
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
    this.audio.updateFootsteps(actuallyMoved);
    this.audio.updateEnemyGrowl(closestEnemyDist, MAX_HEAR_DISTANCE);
  };

  private spawnCrowFlocks(playerSpawnX: number, playerSpawnY: number) {
    // Collect all tree tile pixel centers that are far enough from the player
    const candidates: { x: number; y: number }[] = [];
    for (let ty = 0; ty < this.tiles.length; ty++) {
      for (let tx = 0; tx < this.tiles[ty].length; tx++) {
        const tile = this.tiles[ty][tx];
        if (tile !== TileType.TREE && tile !== TileType.DENSE_TREE) continue;
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        const dx = wx - playerSpawnX;
        const dy = wy - playerSpawnY;
        if (dx * dx + dy * dy < 350 * 350) continue; // too close to start
        candidates.push({ x: wx, y: wy });
      }
    }

    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Greedily pick locations with minimum spacing between flocks
    const FLOCK_COUNT = 28;
    const MIN_SPACING_SQ = 320 * 320;
    const placed: { x: number; y: number }[] = [];

    for (const pos of candidates) {
      if (placed.length >= FLOCK_COUNT) break;
      const tooClose = placed.some((p) => {
        const dx = p.x - pos.x;
        const dy = p.y - pos.y;
        return dx * dx + dy * dy < MIN_SPACING_SQ;
      });
      if (!tooClose) {
        placed.push(pos);
        this.crowFlocks.push(new CrowFlock(pos.x, pos.y));
      }
    }
  }

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
    // Enemy proximity bonus — scales from 0 at 600 px to full at 80 px
    const ENEMY_MAX_DIST = 600;
    const ENEMY_MIN_DIST = 80;
    const enemyThreat = closestEnemyDist < ENEMY_MAX_DIST
      ? 1 - Math.min(1, Math.max(0, (closestEnemyDist - ENEMY_MIN_DIST) / (ENEMY_MAX_DIST - ENEMY_MIN_DIST)))
      : 0;

    const underThreat = isMoving || enemyThreat > 0;

    // Base target from movement state
    let target: number;
    if (isMoving) {
      // Running: 90–130 bpm with noise
      target = 90 + Math.random() * 40;
    } else {
      // At rest: narrow band around 65 to avoid wild oscillation.
      // Slowly drift up toward a slightly elevated level so HR doesn't
      // snap to resting while still cooling down from recent activity.
      target = 63 + Math.random() * 5; // 63–68 bpm
    }

    // Boost toward max when enemies are near
    if (enemyThreat > 0) {
      target = target + enemyThreat * (185 - target);
    }

    // Max drift per second — randomised when cooling down so the descent
    // feels organic rather than a steady 15 bpm/s slope.
    const coolingDown = !underThreat && this.heartRate > 75;
    const maxDelta = coolingDown ? 6 + Math.random() * 14 : 15; // 6–20 bpm/s while cooling
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
    try {
      this.audio.stopAll();
      this.audio.playDeath();
    } catch {
      // Audio failure must not block the game-over transition
    }
    this.onStateChange(GameState.GAME_OVER);
  }

  private handleWin() {
    this.gameOver = true;
    try {
      this.audio.stopAll();
      this.audio.playWin();
    } catch {
      // Audio failure must not block the win transition
    }
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
