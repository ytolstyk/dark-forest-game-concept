import { createNoise2D } from 'simplex-noise';

export function createNoiseGenerator(seed?: number) {
  const noise2D = createNoise2D(seed !== undefined ? () => seed : undefined);

  function octaveNoise(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2,
    scale: number = 0.01
  ): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue; // Normalized to [-1, 1]
  }

  return { noise2D, octaveNoise };
}
