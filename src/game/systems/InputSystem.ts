export class InputSystem {
  private keys: Set<string> = new Set();
  private justPressedKeys: Set<string> = new Set();
  private previousKeys: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  update() {
    this.justPressedKeys.clear();
    for (const key of this.keys) {
      if (!this.previousKeys.has(key)) {
        this.justPressedKeys.add(key);
      }
    }
    this.previousKeys = new Set(this.keys);
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  justPressed(code: string): boolean {
    return this.justPressedKeys.has(code);
  }

  get moveX(): number {
    let x = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    return x;
  }

  get moveY(): number {
    let y = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    return y;
  }
}
