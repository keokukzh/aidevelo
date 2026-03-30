/**
 * Deterministic seeded random number generator.
 * Returns a value in [0, 1] based on seed string.
 */
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647;
}

/**
 * Returns a seeded random number in [min, max].
 */
function seededFloat(seed: string, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

export interface AgentPersonality {
  walkSpeed: number;         // 0.8 – 1.2
  armSwingAmplitude: number; // 0.7 – 1.3
  typeSpeed: number;         // 0.85 – 1.15
  bobAmplitude: number;      // 0.7 – 1.2
  headSway: number;          // 0.5 – 1.5
}

const WALK_SPEED_MIN = 0.8;
const WALK_SPEED_MAX = 1.2;
const ARM_SWING_MIN = 0.7;
const ARM_SWING_MAX = 1.3;
const TYPE_SPEED_MIN = 0.85;
const TYPE_SPEED_MAX = 1.15;
const BOB_AMP_MIN = 0.7;
const BOB_AMP_MAX = 1.2;
const HEAD_SWAY_MIN = 0.5;
const HEAD_SWAY_MAX = 1.5;

export function derivePersonality(agentId: string): AgentPersonality {
  return {
    walkSpeed: seededFloat(agentId + 'ws', WALK_SPEED_MIN, WALK_SPEED_MAX),
    armSwingAmplitude: seededFloat(agentId + 'asa', ARM_SWING_MIN, ARM_SWING_MAX),
    typeSpeed: seededFloat(agentId + 'ts', TYPE_SPEED_MIN, TYPE_SPEED_MAX),
    bobAmplitude: seededFloat(agentId + 'ba', BOB_AMP_MIN, BOB_AMP_MAX),
    headSway: seededFloat(agentId + 'hs', HEAD_SWAY_MIN, HEAD_SWAY_MAX),
  };
}
