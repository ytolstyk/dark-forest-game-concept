// Procedural sprite generation is done inline in entity classes
// This file exists as a namespace for any shared sprite utilities

export function hashColor(base: number, variation: number): number {
  const r = ((base >> 16) & 0xff) + Math.floor((Math.random() - 0.5) * variation);
  const g = ((base >> 8) & 0xff) + Math.floor((Math.random() - 0.5) * variation);
  const b = (base & 0xff) + Math.floor((Math.random() - 0.5) * variation);
  return (
    (Math.max(0, Math.min(255, r)) << 16) |
    (Math.max(0, Math.min(255, g)) << 8) |
    Math.max(0, Math.min(255, b))
  );
}
