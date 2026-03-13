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
    const hash = (tx * 7919 + ty * 104729) % 100;

    switch (tile) {
      case TileType.GRASS:
        if (hash < 30) {
          const bx = px + (hash % 24) + 4;
          const by = py + ((hash * 3) % 24) + 4;
          ctx.strokeStyle = '#4a8a3a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, by + 4);
          ctx.lineTo(bx + 1, by);
          ctx.stroke();
        }
        break;

      case TileType.TALL_GRASS:
        ctx.strokeStyle = '#2a5a18';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const bx = px + ((hash + i * 10) % 28) + 2;
          const by = py + ((hash + i * 17) % 20) + 6;
          ctx.beginPath();
          ctx.moveTo(bx, by + 6);
          ctx.lineTo(bx + (i - 1), by);
          ctx.stroke();
        }
        break;

      case TileType.DEEP_WATER:
      case TileType.SHALLOW_WATER:
        if (hash < 15) {
          const wx = px + 8 + (hash % 16);
          const wy = py + 8 + ((hash * 7) % 16);
          ctx.strokeStyle =
            tile === TileType.DEEP_WATER
              ? 'rgba(42,74,108,0.4)'
              : 'rgba(58,106,156,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(wx - 3, wy);
          ctx.lineTo(wx + 3, wy);
          ctx.stroke();
        }
        break;

      case TileType.TREE:
      case TileType.DENSE_TREE:
        // Trunk
        ctx.fillStyle = '#4a3728';
        ctx.fillRect(px + 13, py + 13, 6, 6);
        // Canopy
        ctx.fillStyle =
          tile === TileType.TREE
            ? 'rgba(26,58,14,0.9)'
            : 'rgba(14,42,6,0.9)';
        ctx.beginPath();
        ctx.arc(px + 16, py + 12, 10 + (hash % 4), 0, Math.PI * 2);
        ctx.fill();
        break;

      case TileType.BUILDING_WALL:
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + 8);
        ctx.lineTo(px + TILE_SIZE, py + 8);
        ctx.moveTo(px, py + 24);
        ctx.lineTo(px + TILE_SIZE, py + 24);
        ctx.moveTo(px + 16, py);
        ctx.lineTo(px + 16, py + TILE_SIZE);
        ctx.stroke();
        break;

      case TileType.BRIDGE:
        ctx.strokeStyle = '#6b5510';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + 8);
        ctx.lineTo(px + TILE_SIZE, py + 8);
        ctx.moveTo(px, py + 16);
        ctx.lineTo(px + TILE_SIZE, py + 16);
        ctx.moveTo(px, py + 24);
        ctx.lineTo(px + TILE_SIZE, py + 24);
        ctx.stroke();
        break;
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
