# Virtual Office Animation Personality Design

## Status
Approved 2026-03-30

## Overview

Add deterministic personality variation to Virtual Office agent animations so no two agents look alike. Each agent derives unique animation parameters from their `agent.id` — consistent across renders but distinct per agent.

## Personality Parameters

Derived per-agent from seeded random using `agent.id`:

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `walkSpeed` | 0.8 – 1.2 | 1.0 | Walk cycle speed multiplier |
| `armSwingAmplitude` | 0.7 – 1.3 | 1.0 | Arm swing intensity |
| `typeSpeed` | 0.85 – 1.15 | 1.0 | Typing oscillation speed |
| `bobAmplitude` | 0.7 – 1.2 | 1.0 | Vertical bob intensity |
| `headSway` | 0.5 – 1.5 | 1.0 | Subtle head micro-movement |

## Animation Layers

### Layer 1: Idle Micro-Movements (always active)
- **Breathing**: chest expands/contracts (±1-2%) on 4-second cycle
- **Weight shift**: subtle hip sway, 0.1 amplitude
- **Head drift**: micro-nodding, randomized direction per agent

### Layer 2: State Animation (walking OR typing, exclusive)
- **Walking**: arm swing + head bob + walk rhythm
  - Arm swing uses `armSwingAmplitude * baseSwing`
  - Walk duration uses `walkSpeed * baseWalkDuration`
  - Head bob amplitude uses `bobAmplitude`
- **Typing**: synchronized arm oscillation + slight head bob
  - Type speed uses `typeSpeed * baseTypingFrequency`
  - Arms oscillate ±0.03 radians at typing rhythm
  - Head bobs ±0.01 radians synced but offset

### Layer 3: Situational Overlays
- **Away**: floating ZZZ + closed/sleeping eyes
- **Active run**: pulsing green ring + faster typing oscillation (+20% typeSpeed)
- **Error**: red glow + body shake (±0.03 x-offset)

## Seeding Function

```typescript
function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const normalized = Math.abs(hash) / 2147483647;
  return min + normalized * (max - min);
}

interface AgentPersonality {
  walkSpeed: number;
  armSwingAmplitude: number;
  typeSpeed: number;
  bobAmplitude: number;
  headSway: number;
}

function derivePersonality(agentId: string): AgentPersonality {
  return {
    walkSpeed: seededRandom(agentId + 'ws', 0.8, 1.2),
    armSwingAmplitude: seededRandom(agentId + 'asa', 0.7, 1.3),
    typeSpeed: seededRandom(agentId + 'ts', 0.85, 1.15),
    bobAmplitude: seededRandom(agentId + 'ba', 0.7, 1.2),
    headSway: seededRandom(agentId + 'hs', 0.5, 1.5),
  };
}
```

## File Changes

### `ui/src/features/virtual-office/core/personality.ts` (NEW)
- `seededRandom()` function
- `derivePersonality()` function
- `AgentPersonality` interface

### `ui/src/features/virtual-office/hooks/useOfficeAnimations.ts` (MODIFY)
- Accept personality params in animation state
- Apply `walkSpeed` to walk duration
- Apply `bobAmplitude` to Y-position bobbing
- Add idle micro-movements to animation state

### `ui/src/features/virtual-office/objects/AgentModel.tsx` (MODIFY)
- Import `derivePersonality` from personality.ts
- Call `derivePersonality(agent.id)` in useMemo
- Pass personality to `AgentArms` and animation calculations
- `AgentArms`: typing uses `personality.typeSpeed`
- `AgentArms`: walking uses `personality.armSwingAmplitude`
- Add breathing animation to body group
- Add head sway to `AgentFace`
- Active run faster typing: `typeSpeed * 1.2`

### `ui/src/features/virtual-office/components/AgentTooltip.tsx` (MODIFY)
- No changes needed — already receives agent

## Backward Compatibility

All personality values default to 1.0 if not provided — no breaking changes to existing agent data or API.

## Testing Checklist

- [ ] Two agents of same state look visually different
- [ ] Agent personality is consistent across re-renders
- [ ] Walking speed varies noticeably between agents
- [ ] Typing oscillation has audible-like rhythm variation
- [ ] Idle breathing is visible but subtle
- [ ] Active run agents type faster than idle working agents
