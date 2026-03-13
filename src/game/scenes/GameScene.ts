import { Application, Container } from 'pixi.js';
import { GameState, EnemyState, CollectibleType, TileType } from '../types';
import { MAX_HEAR_DISTANCE } from '../constants';
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

  private input: InputSystem;
  private camera: CameraSystem;
  private collision: CollisionSystem;
  private lighting: LightingSystem;
  private enemyAI: EnemyAISystem;
  private pathfinding: PathfindingSystem;
  private audio: AudioSystem;
  private particles: ParticleEffects;

  private anyEnemyChasing = false;
  private gameOver = false;

  // Expose state for React HUD
  torchOn = false;
  inventory = { keys: false, fuel: false };

  constructor(app: Application, onStateChange: (state: string) => void) {
    this.app = app;
    this.onStateChange = onStateChange;

    this.worldContainer = new Container();
    this.entityContainer = new Container();

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

    // Create enemies
    this.enemies = [];
    for (const spawn of mapData.enemySpawns) {
      const enemyScale = 1 + Math.random(); // 1.0 – 2.0
      this.enemies.push(new Enemy(spawn.x, spawn.y, enemyScale));
    }

    // Create collectibles
    this.collectibles = [
      new Collectible(mapData.carPosition.x, mapData.carPosition.y, CollectibleType.CAR),
      new Collectible(mapData.keysPosition.x, mapData.keysPosition.y, CollectibleType.KEYS),
      new Collectible(mapData.fuelPosition.x, mapData.fuelPosition.y, CollectibleType.FUEL),
    ];

    // Build scene graph: map -> entities -> particles -> darkness -> glow
    this.worldContainer.addChild(this.tileMap.container);
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

    if (this.collision.canMoveTo(newX, newY, 8)) {
      this.player.position.x = newX;
      this.player.position.y = newY;
    } else if (this.collision.canMoveTo(newX, this.player.position.y, 8)) {
      this.player.position.x = newX;
    } else if (this.collision.canMoveTo(this.player.position.x, newY, 8)) {
      this.player.position.y = newY;
    }

    // 5. Enemy AI
    let anyChasing = false;
    let closestEnemyDist = Infinity;

    for (const enemy of this.enemies) {
      this.enemyAI.update(enemy, this.player.position, this.player.torchOn);
      enemy.updateVisual();

      const dist = distance(enemy.position, this.player.position);
      if (dist < closestEnemyDist) closestEnemyDist = dist;

      if (enemy.state === EnemyState.CHASE) anyChasing = true;

      // 6. Enemy-player collision (death)
      if (this.collision.circleCollision(enemy.position, 12, this.player.position, 8)) {
        this.handleDeath();
        return;
      }
    }

    // Chase music
    if (anyChasing && !this.anyEnemyChasing) {
      this.audio.startChaseMusic();
    } else if (!anyChasing && this.anyEnemyChasing) {
      this.audio.stopChaseMusic();
    }
    this.anyEnemyChasing = anyChasing;

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

    // 8. Update player visual
    this.player.updateVisual();

    // 9. Camera
    this.camera.update(this.player.position, screenW, screenH);
    this.camera.apply(this.worldContainer);

    // 10. Particles
    this.particles.update(this.player.position, this.player.torchOn, this.camera.x, this.camera.y);

    // 11. Lighting
    const enemyGlows: { position: { x: number; y: number }; color: number; radius: number; alpha: number }[] = [];
    for (const enemy of this.enemies) {
      const [left, right] = enemy.getEyeWorldPositions();
      const glowAlpha = enemy.state === EnemyState.CHASE ? 0.9 : 0.6;
      enemyGlows.push({ position: left, color: 0xaaff44, radius: 3, alpha: glowAlpha });
      enemyGlows.push({ position: right, color: 0xaaff44, radius: 3, alpha: glowAlpha });
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
      itemGlows
    );

    // 12. Audio
    this.audio.updateFootsteps(isMoving);
    this.audio.updateEnemyGrowl(closestEnemyDist, MAX_HEAR_DISTANCE);
  };

  private handleDeath() {
    this.gameOver = true;
    this.audio.stopChaseMusic();
    this.audio.playDeath();
    this.onStateChange(GameState.GAME_OVER);
  }

  private handleWin() {
    this.gameOver = true;
    this.audio.stopChaseMusic();
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
