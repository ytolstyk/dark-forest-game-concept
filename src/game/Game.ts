import { Application } from 'pixi.js';
import { GameScene } from './scenes/GameScene';
import type { GameOptions } from './types';
import { DEFAULT_GAME_OPTIONS } from './types';

export class Game {
  app: Application;
  scene: GameScene | null = null;
  private _onStateChange: ((state: string) => void) | null = null;
  private _initialized = false;
  private _destroyed = false;
  private _tickerCallback: (() => void) | null = null;
  private _onResize: (() => void) | null = null;

  constructor() {
    this.app = new Application();
  }

  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x000000,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    if (this._destroyed) {
      // Stop ticker but do NOT call app.destroy() — that would kill the shared
      // WebGL context on the canvas, breaking any subsequent Game.init() on the
      // same element (React StrictMode mounts effects twice in development).
      this.app.stop();
      return;
    }

    this._initialized = true;

    const onResize = () => {
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    this._onResize = onResize;
  }

  onStateChange(callback: (state: string) => void) {
    this._onStateChange = callback;
  }

  async startGame(onProgress?: (pct: number) => void, options: GameOptions = DEFAULT_GAME_OPTIONS) {
    if (this._tickerCallback) {
      this.app.ticker.remove(this._tickerCallback);
      this._tickerCallback = null;
    }
    if (this.scene) {
      this.scene.destroy();
      this.scene = null;
    }

    this.scene = new GameScene(this.app, (state: string) => {
      this._onStateChange?.(state);
    });
    await this.scene.init(onProgress, options);

    this._tickerCallback = () => { this.scene?.update(); };
    this.app.ticker.add(this._tickerCallback);
  }

  stopGame() {
    if (this._tickerCallback) {
      this.app.ticker.remove(this._tickerCallback);
      this._tickerCallback = null;
    }
    if (this.scene) {
      this.scene.destroy();
      this.scene = null;
    }
  }

  destroy() {
    this._destroyed = true;
    if (!this._initialized) return;
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
    this.stopGame();
    this.app.destroy();
  }
}
