export class InputSystem {
  private keys: Set<string> = new Set();
  private justPressedKeys: Set<string> = new Set();
  private previousKeys: Set<string> = new Set();
  private virtualPressQueue: Set<string> = new Set();
  private _virtualX = 0;
  private _virtualY = 0;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  setVirtualMove(x: number, y: number) {
    this._virtualX = x;
    this._virtualY = y;
  }

  triggerVirtualPress(code: string) {
    this.virtualPressQueue.add(code);
  }

  update() {
    this.justPressedKeys.clear();
    for (const key of this.keys) {
      if (!this.previousKeys.has(key)) {
        this.justPressedKeys.add(key);
      }
    }
    for (const code of this.virtualPressQueue) {
      this.justPressedKeys.add(code);
    }
    this.virtualPressQueue.clear();
    this.previousKeys = new Set(this.keys);
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  justPressed(code: string): boolean {
    return this.justPressedKeys.has(code);
  }

  get moveX(): number {
    let x = this._virtualX;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    return Math.max(-1, Math.min(1, x));
  }

  get moveY(): number {
    let y = this._virtualY;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    return Math.max(-1, Math.min(1, y));
  }
}
