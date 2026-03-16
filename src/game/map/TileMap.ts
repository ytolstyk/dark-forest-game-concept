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

      case TileType.FENCE: {
        // Weathered wooden fence — two vertical posts with a horizontal rail
        const postW = 4;
        const postColor = '#6b4522';
        const railColor = '#7d5828';
        // Left post
        ctx.fillStyle = postColor;
        ctx.fillRect(px + 3, py + 1, postW, TILE_SIZE - 2);
        // Right post
        ctx.fillRect(px + TILE_SIZE - 7, py + 1, postW, TILE_SIZE - 2);
        // Shadow edge on posts
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(px + 3 + postW - 1, py + 2, 1, TILE_SIZE - 4);
        ctx.fillRect(px + TILE_SIZE - 7 + postW - 1, py + 2, 1, TILE_SIZE - 4);
        // Horizontal rail
        const railY = py + Math.round(TILE_SIZE * 0.48);
        ctx.fillStyle = railColor;
        ctx.fillRect(px + 1, railY, TILE_SIZE - 2, 5);
        // Wood grain on rail
        ctx.strokeStyle = 'rgba(80,45,10,0.42)';
        ctx.lineWidth = 1;
        for (let gi = 0; gi < 4; gi++) {
          const gx = px + 5 + gi * 7 + (hash % 3);
          ctx.beginPath();
          ctx.moveTo(gx, railY + 1);
          ctx.lineTo(gx + 5, railY + 3);
          ctx.stroke();
        }
        // Nail dots on posts
        ctx.fillStyle = '#3a2510';
        ctx.fillRect(px + 5, railY + 1, 2, 2);
        ctx.fillRect(px + TILE_SIZE - 6, railY + 1, 2, 2);
        break;
      }

      case TileType.PROP: {
        // Subtle grass micro-variation for ground
        const gv = (hash % 10) - 5;
        if (gv > 0) {
          ctx.fillStyle = `rgba(60,${128 + gv},50,0.13)`;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        const propType = hash % 5;
        if (propType === 0) {
          // Shovel lying on ground
          ctx.save();
          ctx.translate(px + 15, py + 16);
          ctx.rotate(-0.35 + (hash2 % 5) * 0.12);
          ctx.fillStyle = '#7a5530';
          ctx.fillRect(-2, -11, 3, 20); // handle
          ctx.fillStyle = '#9a9080';
          ctx.beginPath();
          ctx.moveTo(-4, 9); ctx.lineTo(5, 9); ctx.lineTo(4, 15); ctx.lineTo(-3, 15);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#6a6050'; ctx.lineWidth = 1; ctx.stroke();
          ctx.restore();
        } else if (propType === 1) {
          // Axe
          ctx.save();
          ctx.translate(px + 16, py + 16);
          ctx.rotate(0.6 + (hash2 % 4) * 0.2);
          ctx.fillStyle = '#7a5530';
          ctx.fillRect(-1, -12, 3, 22); // handle
          ctx.fillStyle = '#8a8070';
          ctx.beginPath();
          ctx.moveTo(2, -10); ctx.lineTo(10, -5); ctx.lineTo(9, 3); ctx.lineTo(2, 1);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#b0a090'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(9, 3); ctx.stroke();
          ctx.restore();
        } else if (propType === 2) {
          // Wooden crate
          const cw = 18, ch = 14;
          const cx2 = px + 7, cy2 = py + 9;
          ctx.fillStyle = '#7a6040';
          ctx.fillRect(cx2, cy2, cw, ch);
          ctx.strokeStyle = '#5a4020';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx2, cy2, cw, ch);
          ctx.beginPath();
          ctx.moveTo(cx2 + cw / 2, cy2); ctx.lineTo(cx2 + cw / 2, cy2 + ch);
          ctx.moveTo(cx2, cy2 + ch / 2); ctx.lineTo(cx2 + cw, cy2 + ch / 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(cx2 + 1, cy2 + 1, cw - 2, 3);
        } else if (propType === 3) {
          // Old barrel
          const bx2 = px + 10, by2 = py + 7;
          const bw = 12, bh = 16;
          ctx.fillStyle = '#6b4e28';
          ctx.fillRect(bx2, by2, bw, bh);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(bx2 + bw - 3, by2 + 1, 2, bh - 2);
          ctx.strokeStyle = '#3a2810';
          ctx.lineWidth = 1.5;
          for (const oy of [3, 8, 13]) {
            ctx.beginPath();
            ctx.moveTo(bx2, by2 + oy); ctx.lineTo(bx2 + bw, by2 + oy); ctx.stroke();
          }
        } else {
          // Scattered planks / debris
          const plankColor = '#8a6840';
          const angles = [-0.3 + (hash2 % 4) * 0.15, 0.7 + (hash3 % 3) * 0.2];
          for (let i = 0; i < 2; i++) {
            ctx.save();
            ctx.translate(px + 9 + i * 9, py + 13 + i * 4);
            ctx.rotate(angles[i]);
            ctx.fillStyle = plankColor;
            ctx.fillRect(-8, -2, 16, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(-7, -1, 14, 1);
            ctx.restore();
          }
        }
        break;
      }

      case TileType.TRACTOR: {
        // Top-down abandoned farm tractor
        // Drop shadow
        ctx.save();
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(px + 17, py + 24, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Large rear wheels
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(px + 5,  py + 22, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 27, py + 22, 5, 0, Math.PI * 2); ctx.fill();
        // Rear wheel hubs
        ctx.fillStyle = '#3a2a18';
        ctx.beginPath(); ctx.arc(px + 5,  py + 22, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 27, py + 22, 2, 0, Math.PI * 2); ctx.fill();

        // Small front wheels
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(px + 9,  py + 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 23, py + 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2a18';
        ctx.beginPath(); ctx.arc(px + 9,  py + 10, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 23, py + 10, 1.5, 0, Math.PI * 2); ctx.fill();

        // Main body (rusty red-brown)
        ctx.fillStyle = '#7a3520';
        ctx.fillRect(px + 8, py + 13, 16, 12);
        // Rust patches
        if (hash > 35)  { ctx.fillStyle = '#4a2012'; ctx.fillRect(px + 10, py + 15, 4, 3); }
        if (hash2 > 48) { ctx.fillStyle = '#4a2012'; ctx.fillRect(px + 17, py + 19, 5, 3); }
        // Body highlight
        ctx.fillStyle = 'rgba(220,140,80,0.08)';
        ctx.fillRect(px + 9, py + 13, 14, 2);

        // Engine hood
        ctx.fillStyle = '#6a3018';
        ctx.fillRect(px + 10, py + 7, 12, 8);
        // Hood line detail
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 16, py + 7); ctx.lineTo(px + 16, py + 14); ctx.stroke();

        // Cab
        ctx.fillStyle = '#5a3028';
        ctx.fillRect(px + 9, py + 2, 14, 7);
        // Cab window
        ctx.fillStyle = 'rgba(80,120,160,0.38)';
        ctx.fillRect(px + 11, py + 3, 10, 5);
        // Window frame
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 11, py + 3, 10, 5);
        // Cab highlight
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(px + 9, py + 2, 14, 2);

        // Exhaust pipe
        ctx.fillStyle = '#2a2218';
        ctx.fillRect(px + 18, py - 1, 3, 5);
        if (hash3 > 55) {
          // Faint exhaust smudge
          ctx.fillStyle = 'rgba(60,55,50,0.22)';
          ctx.beginPath();
          ctx.arc(px + 19, py - 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
