// Tile rendering is handled directly in TileMap.ts drawTileDetail method
// This file exists as a namespace for any shared tile rendering utilities

export function tileVariation(x: number, y: number): number {
  return ((x * 7919 + y * 104729) % 100) / 100;
}
