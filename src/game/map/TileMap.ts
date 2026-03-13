import { Texture, ImageSource, Sprite, Container } from 'pixi.js';
import { TileType } from '../types';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../constants';
import { TILE_COLORS } from './TileTypes';

function hexToCSS(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

const CHUNK_TILES = 50; // 50 tiles × 32px = 1600px per chunk
const CHUNK_COLS = Math.ceil(MAP_WIDTH / CHUNK_TILES);   // 4
const CHUNK_ROWS = Math.ceil(MAP_HEIGHT / CHUNK_TILES);  // 4
const CHUNK_PX = CHUNK_TILES * TILE_SIZE;                // 1600

export class TileMap {
  container: Container;

  constructor() {
    this.container = new Container();
  }

  async render(tiles: TileType[][], onProgress?: (pct: number) => void) {
    const totalChunks = CHUNK_COLS * CHUNK_ROWS;
    let chunksRendered = 0;

    for (let cy = 0; cy < CHUNK_ROWS; cy++) {
      for (let cx = 0; cx < CHUNK_COLS; cx++) {
        const canvas = document.createElement('canvas');
        canvas.width = CHUNK_PX;
        canvas.height = CHUNK_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2d canvas context');

        const tileStartX = cx * CHUNK_TILES;
        const tileStartY = cy * CHUNK_TILES;

        for (let ty = tileStartY; ty < tileStartY + CHUNK_TILES && ty < MAP_HEIGHT; ty++) {
          for (let tx = tileStartX; tx < tileStartX + CHUNK_TILES && tx < MAP_WIDTH; tx++) {
            const tile = tiles[ty][tx];
            const px = (tx - tileStartX) * TILE_SIZE;
            const py = (ty - tileStartY) * TILE_SIZE;

            ctx.fillStyle = hexToCSS(TILE_COLORS[tile]);
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            this.drawTileDetail(ctx, tile, px, py, tx, ty);
          }
        }

        const source = new ImageSource({ resource: canvas });
        const texture = new Texture({ source });
        const sprite = new Sprite(texture);
        sprite.x = cx * CHUNK_PX;
        sprite.y = cy * CHUNK_PX;
        this.container.addChild(sprite);

        chunksRendered++;
        onProgress?.(chunksRendered / totalChunks);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    onProgress?.(1);
  }

  private drawTileDetail(
    ctx: CanvasRenderingContext2D,
    tile: TileType,
    px: number,
    py: number,
    tx: number,
    ty: number
  ) {
    const hash  = (tx * 7919  + ty * 104729) % 100;
    const hash2 = (tx * 6271  + ty * 95813)  % 100;
    const hash3 = (tx * 13337 + ty * 131071) % 100;

    switch (tile) {
      case TileType.GRASS: {
        // Subtle colour micro-variation
        const v = (hash % 12) - 6;
        if (v > 0) {
          ctx.fillStyle = `rgba(60,${130 + v},50,0.15)`;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        // 1-3 curved grass blades
        const bladeCount = 1 + (hash % 3);
        ctx.lineWidth = 1;
        for (let i = 0; i < bladeCount; i++) {
          const bx   = px + ((hash  + i * 23) % 22) + 5;
          const by   = py + ((hash2 + i * 17) % 22) + 5;
          const lean = ((hash3 + i * 7) % 5) - 2;
          ctx.strokeStyle = (hash + i) % 2 === 0 ? '#4a8e36' : '#3a7828';
          ctx.beginPath();
          ctx.moveTo(bx, by + 5);
          ctx.quadraticCurveTo(bx + lean, by + 2, bx + lean * 2, by);
          ctx.stroke();
        }
        break;
      }

      case TileType.TALL_GRASS: {
        // 4 tall curved blades with height variation
        for (let i = 0; i < 4; i++) {
          const bx     = px + ((hash  + i * 19) % 24) + 4;
          const by     = py + ((hash2 + i * 13) % 14) + 10;
          const height = 7 + ((hash3 + i * 7) % 5);
          const lean   = ((hash  + i * 11) % 7) - 3;
          ctx.strokeStyle = i % 2 === 0 ? '#2d6618' : '#1e4a10';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, by + height);
          ctx.quadraticCurveTo(bx + lean / 2, by + height / 2, bx + lean, by);
          ctx.stroke();
        }
        break;
      }

      case TileType.DEEP_WATER:
      case TileType.SHALLOW_WATER: {
        const isDeep = tile === TileType.DEEP_WATER;
        // Arc ripples
        if (hash < 45) {
          const wx = px + 4 + (hash % 20);
          const wy = py + 6 + ((hash * 5) % 18);
          ctx.strokeStyle = isDeep
            ? 'rgba(50,90,145,0.55)'
            : 'rgba(70,125,185,0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(wx, wy, 3 + (hash % 3), 0, Math.PI);
          ctx.stroke();
        }
        if (hash2 < 35) {
          const wx = px + 8 + (hash2 % 16);
          const wy = py + 14 + ((hash2 * 7) % 10);
          ctx.strokeStyle = isDeep
            ? 'rgba(55,95,155,0.35)'
            : 'rgba(85,140,205,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(wx, wy, 2 + (hash2 % 2), 0, Math.PI);
          ctx.stroke();
        }
        // Specular glint
        if (hash3 > 72) {
          const sx = px + 5 + (hash3 % 18);
          const sy = py + 4 + (hash  % 18);
          ctx.fillStyle = isDeep
            ? 'rgba(110,160,230,0.28)'
            : 'rgba(140,190,245,0.32)';
          ctx.beginPath();
          ctx.ellipse(sx, sy, 3, 1.5, -0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case TileType.TREE:
      case TileType.DENSE_TREE: {
        const isDense    = tile === TileType.DENSE_TREE;
        const canopyX    = px + 16;
        const canopyY    = py + 13;
        const baseRadius = isDense ? 13 : 11 + (hash % 3);

        // Soft drop-shadow
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(canopyX + 3, canopyY + 5, baseRadius - 1, baseRadius - 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Trunk
        ctx.fillStyle = '#3a2818';
        ctx.fillRect(canopyX - 2, canopyY + 3, 5, 7);
        ctx.fillStyle = 'rgba(80,55,30,0.65)';
        ctx.fillRect(canopyX - 1, canopyY + 4, 2, 5);

        // Dark rim (shadow side — offset right/down)
        ctx.fillStyle = isDense ? '#030d02' : '#061203';
        ctx.beginPath();
        ctx.arc(canopyX + 1, canopyY + 1, baseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Canopy body — radial gradient (light top-left → dark bottom-right)
        const bodyGrad = ctx.createRadialGradient(
          canopyX - 4, canopyY - 5, 1,
          canopyX,     canopyY,     baseRadius
        );
        if (isDense) {
          bodyGrad.addColorStop(0,    '#1e5a0a');
          bodyGrad.addColorStop(0.45, '#0f3205');
          bodyGrad.addColorStop(0.78, '#081d02');
          bodyGrad.addColorStop(1,    '#030e01');
        } else {
          bodyGrad.addColorStop(0,    '#36820e');
          bodyGrad.addColorStop(0.42, '#1e5208');
          bodyGrad.addColorStop(0.75, '#0f2f03');
          bodyGrad.addColorStop(1,    '#061801');
        }
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(canopyX, canopyY, baseRadius - 1, 0, Math.PI * 2);
        ctx.fill();

        // Organic edge clumps (bumps around perimeter for irregular silhouette)
        const clumpCount = 4 + (hash % 3);
        for (let i = 0; i < clumpCount; i++) {
          const angle  = (i / clumpCount) * Math.PI * 2 + (hash * 0.063);
          const cr     = baseRadius - 3 + ((hash2 + i * 13) % 4);
          const clumpX = canopyX + Math.cos(angle) * cr;
          const clumpY = canopyY + Math.sin(angle) * cr;
          const clumpR = 4 + ((hash3 + i * 7) % 4);
          const g      = isDense
            ? 22 + (i * 4) % 12
            : 52 + (i * 6) % 20;
          ctx.fillStyle = `rgba(0,${g},0,0.82)`;
          ctx.beginPath();
          ctx.arc(clumpX, clumpY, clumpR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Top-left highlight (simulates sunlight on canopy dome)
        const hlGrad = ctx.createRadialGradient(
          canopyX - 5, canopyY - 6, 0,
          canopyX - 5, canopyY - 6, 9
        );
        if (isDense) {
          hlGrad.addColorStop(0,   'rgba(38,105,14,0.78)');
          hlGrad.addColorStop(0.5, 'rgba(18,62,6,0.38)');
          hlGrad.addColorStop(1,   'rgba(0,0,0,0)');
        } else {
          hlGrad.addColorStop(0,   'rgba(70,165,28,0.72)');
          hlGrad.addColorStop(0.5, 'rgba(42,105,14,0.35)');
          hlGrad.addColorStop(1,   'rgba(0,0,0,0)');
        }
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(canopyX - 4, canopyY - 5, 9, 0, Math.PI * 2);
        ctx.fill();

        break;
      }

      case TileType.DIRT_PATH: {
        // Pebble scatter
        const pebbleCount = 2 + (hash % 3);
        for (let i = 0; i < pebbleCount; i++) {
          const ppx = px + 4 + ((hash  + i * 19) % 24);
          const ppy = py + 4 + ((hash2 + i * 13) % 24);
          const pr  = 1 + (hash3 + i) % 2;
          ctx.fillStyle = (hash + i) % 2 === 0
            ? 'rgba(100,82,55,0.65)'
            : 'rgba(120,98,65,0.5)';
          ctx.beginPath();
          ctx.ellipse(ppx, ppy, pr + 0.5, pr, (hash * 0.2) % Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        // Faint rut line
        if (hash > 58) {
          ctx.strokeStyle = 'rgba(85,65,38,0.28)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + (hash % 16),     py + (hash2 % 14) + 4);
          ctx.lineTo(px + (hash % 16) + 9, py + (hash2 % 14) + 13);
          ctx.stroke();
        }
        break;
      }

      case TileType.BUILDING_WALL: {
        // Offset brick / stone masonry
        const brickH = 8;
        const brickW = 16;
        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 1;
        for (let row = 0; row < Math.ceil(TILE_SIZE / brickH); row++) {
          const rowY   = py + row * brickH;
          const offset = (row % 2) === 0 ? 0 : brickW / 2;
          // Horizontal mortar
          ctx.beginPath();
          ctx.moveTo(px, rowY);
          ctx.lineTo(px + TILE_SIZE, rowY);
          ctx.stroke();
          // Vertical joints
          for (let col = 0; col * brickW - offset < TILE_SIZE + brickW; col++) {
            const jx = px + col * brickW - offset;
            if (jx > px && jx < px + TILE_SIZE) {
              ctx.beginPath();
              ctx.moveTo(jx, rowY);
              ctx.lineTo(jx, rowY + brickH);
              ctx.stroke();
            }
          }
        }
        // Random bright face highlight
        if (hash > 52) {
          const brightRow = hash % 4;
          const brightOff = (brightRow % 2) === 0 ? 0 : brickW / 2;
          const brightCol = hash2 % 2;
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(px + brightCol * brickW - brightOff + 1, py + brightRow * brickH + 1, brickW - 2, brickH - 2);
        }
        break;
      }

      case TileType.BUILDING_FLOOR: {
        // 2×2 stone tile subdivision
        ctx.strokeStyle = 'rgba(40,40,32,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 16, py);
        ctx.lineTo(px + 16, py + TILE_SIZE);
        ctx.moveTo(px,      py + 16);
        ctx.lineTo(px + TILE_SIZE, py + 16);
        ctx.stroke();
        // Faint corner scuff
        if (hash > 44) {
          ctx.fillStyle = 'rgba(0,0,0,0.07)';
          ctx.fillRect(px + 1, py + 1, 4, 4);
        }
        break;
      }

      case TileType.BRIDGE: {
        // Wooden planks — horizontal with grain
        const plankH = TILE_SIZE / 4;
        for (let p = 0; p < 4; p++) {
          const plankY = py + p * plankH;
          // Alternate plank shade
          ctx.fillStyle = p % 2 === 0
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.10)';
          ctx.fillRect(px, plankY, TILE_SIZE, plankH - 1);
          // Wood grain
          ctx.strokeStyle = 'rgba(75,52,8,0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 3, plankY + Math.round(plankH * 0.38));
          ctx.lineTo(px + TILE_SIZE - 3, plankY + Math.round(plankH * 0.38));
          ctx.stroke();
          // Plank separator
          ctx.strokeStyle = '#4a3a08';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, plankY);
          ctx.lineTo(px + TILE_SIZE, plankY);
          ctx.stroke();
        }
        break;
      }

      case TileType.ROAD: {
        // Asphalt micro-texture
        if (hash < 22) {
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(px + (hash % 26) + 3, py + (hash2 % 26) + 3, 2, 2);
        }
        if (hash3 > 76) {
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          ctx.fillRect(px + (hash % 20) + 5, py + (hash2 % 20) + 5, 3, 3);
        }
        break;
      }
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
