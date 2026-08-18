import type { Vibe } from '../types.js';

export const VIBES: Record<string, Vibe> = {
  NIGHT: { key: 'NIGHT', name: 'Night game', bg: [0.035, 0.055, 0.05], bulb: [1.0, 0.72, 0.3], grain: 0.1, bloom: 1.0, sweep: 0.35 },
  DAY: { key: 'DAY', name: 'Day game', bg: [0.1, 0.13, 0.11], bulb: [1.0, 0.94, 0.78], grain: 0.05, bloom: 0.55, sweep: 0.12 },
  TWILIGHT: { key: 'TWILIGHT', name: 'Twilight', bg: [0.06, 0.045, 0.075], bulb: [1.0, 0.55, 0.55], grain: 0.13, bloom: 1.15, sweep: 0.5 },
  BROADCAST: { key: 'BROADCAST', name: '1978 broadcast', bg: [0.02, 0.03, 0.035], bulb: [0.55, 1.0, 0.72], grain: 0.24, bloom: 1.3, sweep: 0.75 }
};
