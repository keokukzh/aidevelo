# Virtual Office Animation Personality Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add deterministic personality variation to Virtual Office agent animations so each agent has unique but consistent animation timing derived from their `agent.id`.

**Architecture:** Create a `personality.ts` utility that generates per-agent animation parameters from a seeded random function. Integration happens in `useOfficeAnimations` (timing) and `AgentModel` (visual animations).

**Tech Stack:** React, TypeScript, Three.js, @react-three/fiber, @react-three/drei

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `ui/src/features/virtual-office/core/personality.ts` | **CREATE** | `seededRandom()`, `derivePersonality()`, `AgentPersonality` interface |
| `ui/src/features/virtual-office/hooks/useOfficeAnimations.ts` | **MODIFY** | Apply `walkSpeed` and `bobAmplitude` to animation state |
| `ui/src/features/virtual-office/objects/AgentModel.tsx` | **MODIFY** | Apply personality to arms, face, body animations |

---

## Task 1: Create personality utility

**Files:**
- Create: `ui/src/features/virtual-office/core/personality.ts`

- [ ] **Step 1: Write personality.ts**

```typescript
// ui/src/features/virtual-office/core/personality.ts

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
  headSway: number;           // 0.5 – 1.5
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd ui && npx tsc --noEmit src/features/virtual-office/core/personality.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add ui/src/features/virtual-office/core/personality.ts
git commit -m "feat(virtual-office): add personality seeding utility

Adds seeded random and derivePersonality() for per-agent animation
variation based on agent.id.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Integrate personality into useOfficeAnimations

**Files:**
- Modify: `ui/src/features/virtual-office/hooks/useOfficeAnimations.ts`

- [ ] **Step 1: Read the current useOfficeAnimations.ts**

```bash
cat ui/src/features/virtual-office/hooks/useOfficeAnimations.ts
```

- [ ] **Step 2: Import derivePersonality**

Add import at the top of the file:
```typescript
import { derivePersonality } from "../core/personality";
```

- [ ] **Step 3: Add personality to AnimationEntry type**

Find the `AnimationEntry` interface (or similar type) and add:
```typescript
export interface AnimationEntry {
  state: AnimationState;
  fromPosition: [number, number, number];
  toPosition: [number, number, number];
  personality: {
    walkSpeed: number;
    bobAmplitude: number;
  };
  // ... existing fields
}
```

- [ ] **Step 4: Apply personality when creating animation entries**

In the function that builds animation entries (likely in `useMemo` that returns `animationStates`), wrap with personality:
```typescript
// Example - where animation states are created:
const personality = derivePersonality(agent.id);
animationStates.set(agent.id, {
  state: /* existing state */,
  fromPosition: /* existing fromPosition */,
  toPosition: /* existing toPosition */,
  personality: {
    walkSpeed: personality.walkSpeed,
    bobAmplitude: personality.bobAmplitude,
  },
});
```

- [ ] **Step 5: Verify compilation**

Run: `cd ui && npx tsc --noEmit src/features/virtual-office/hooks/useOfficeAnimations.ts`
Expected: No errors (may show other pre-existing issues if any)

- [ ] **Step 6: Commit**

```bash
git add ui/src/features/virtual-office/hooks/useOfficeAnimations.ts
git commit -m "feat(virtual-office): apply personality timing to animation states

Passes walkSpeed and bobAmplitude from derivePersonality into
animation state for per-agent variation.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Apply personality to AgentModel animations

**Files:**
- Modify: `ui/src/features/virtual-office/objects/AgentModel.tsx:1-10` (imports)
- Modify: `ui/src/features/virtual-office/objects/AgentModel.tsx:350-380` (main component)

- [ ] **Step 1: Read AgentModel.tsx to understand current structure**

Focus on:
- `AgentArms` function (lines ~98-162) — where typing/walking arm animation happens
- `AgentFace` function (lines ~164-277) — head/face animation
- Main `AgentModel` component (lines ~346-473) — how animState is used
- `useFrame` in main component — where position.y bobbing happens

- [ ] **Step 2: Add personality import and derive it in AgentModel**

In the imports section, add:
```typescript
import { derivePersonality } from "../core/personality";
```

In the main `AgentModel` component, add a useMemo after the existing deskPos/idlePath memos:
```typescript
const personality = useMemo(() => derivePersonality(agent.id), [agent.id]);
```

- [ ] **Step 3: Apply walkSpeed to walk progress in useFrame**

In the `useFrame` callback, find where `walkProgressRef` is incremented during walking:
```typescript
// BEFORE (walk progress increment):
walkProgressRef.current = Math.min(1, walkProgressRef.current + delta / ANIM.WALK_DURATION);

// AFTER (walk speed applied):
const walkDuration = ANIM.WALK_DURATION / (animState?.personality?.walkSpeed ?? 1);
walkProgressRef.current = Math.min(1, walkProgressRef.current + delta / walkDuration);
```

- [ ] **Step 4: Apply bobAmplitude to Y bobbing in useFrame**

Find where `groupRef.current.position.y` is set for walking/idle/patrol:
```typescript
// BEFORE:
groupRef.current.position.y = bob; // bob is from getAnimationBob

// AFTER:
const bobAmp = animState?.personality?.bobAmplitude ?? 1;
groupRef.current.position.y = bob * bobAmp;
```

- [ ] **Step 5: Apply armSwingAmplitude to AgentArms**

The `AgentArms` component receives `state` and `walkProgress`. Modify its `useFrame` to take personality via props or context.

**Option A (recommended — pass as props):**

Update `AgentArms` interface:
```typescript
function AgentArms({ state, walkProgress, personality }: {
  state: string;
  walkProgress: number;
  personality?: { armSwingAmplitude: number; typeSpeed: number };
})
```

In `AgentArms.useFrame`, update the walking arm swing:
```typescript
// BEFORE:
const swing = Math.sin(walkProgress * Math.PI * 6) * 0.4;

// AFTER:
const swingAmp = (personality?.armSwingAmplitude ?? 1) * 0.4;
const swing = Math.sin(walkProgress * Math.PI * 6) * swingAmp;
```

In `AgentArms.useFrame`, update the typing arm oscillation:
```typescript
// BEFORE:
const oscillate = Math.sin(Date.now() * 0.008) * 0.03;

// AFTER:
const typeSpd = personality?.typeSpeed ?? 1;
const oscillate = Math.sin(Date.now() * 0.008 * typeSpd) * 0.03;
```

Update the `AgentModel` render to pass personality:
```typescript
<AgentArms state={currentAnimState} walkProgress={walkProgressRef.current} personality={personality} />
```

- [ ] **Step 6: Add headSway micro-movement to AgentFace**

In `AgentFace`, update the `useFrame` to add subtle head sway. The component already has blink logic — add sway after it:
```typescript
// In AgentFace useFrame, after the blink logic:
// Add head sway (micro-movement, always active)
if (headRef?.current && !isSleeping) {
  const swayAmt = 0.02 * headSway; // headSway from personality
  headRef.current.rotation.y = Math.sin(Date.now() * 0.001 * 0.7) * swayAmt;
  headRef.current.rotation.x = Math.sin(Date.now() * 0.001 * 0.5) * swayAmt * 0.5;
}
```

Note: You'll need to add a `headRef` to the group in the render:
```typescript
const headRef = useRef<THREE.Group>(null);
// ... in render:
<group ref={headRef} position={[0, 1.1, 0]}>
  {/* existing face meshes */}
</group>
```

- [ ] **Step 7: Verify compilation**

Run: `cd ui && npx tsc --noEmit src/features/virtual-office/objects/AgentModel.tsx`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add ui/src/features/virtual-office/objects/AgentModel.tsx
git commit -m "feat(virtual-office): apply personality to agent animations

- walkSpeed affects walk duration (faster/slower walkers)
- bobAmplitude affects vertical bob height
- armSwingAmplitude affects arm swing intensity
- typeSpeed affects typing oscillation frequency
- headSway adds subtle head micro-movement

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Add idle breathing layer to body

**Files:**
- Modify: `ui/src/features/virtual-office/objects/AgentModel.tsx`

- [ ] **Step 1: Add breathing ref and animation**

In `AgentModel`, after `elapsedRef` and `walkProgressRef`, add:
```typescript
const breatheRef = useRef(0);
```

In the `useFrame` callback, add a breathing layer AFTER all other position logic (in the final `else` block for idle/sitting states, and alongside position updates for walking):
```typescript
// Apply breathing to body group Y scale (subtle chest expansion)
const breatheCycle = Math.sin(elapsedRef.current * Math.PI * 0.5); // ~4 second cycle
const breatheScale = 1 + breatheCycle * 0.015; // ±1.5% chest expansion
// This would be applied to a ref on the body mesh group
```

**Implementation note:** Since Three.js meshes don't have a scale ref by default, wrap the body mesh in a group:
```typescript
const bodyRef = useRef<THREE.Group>(null);

// In useFrame, apply breathing scale:
if (bodyRef.current) {
  const breatheCycle = Math.sin(elapsedRef.current * Math.PI * 0.5);
  const breatheScale = 1 + breatheCycle * 0.015;
  bodyRef.current.scale.y = breatheScale;
}
```

In the render, wrap the body meshes:
```typescript
<group ref={bodyRef}>
  <mesh position={[0, 0.6, 0]} castShadow>
    <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
    <meshStandardMaterial color={isAway ? "#6B7280" : agent.color} />
  </mesh>
  <mesh position={[0, 1.1, 0]} castShadow>
    <sphereGeometry args={[0.18, 8, 8]} />
    <meshStandardMaterial color={isAway ? "#6B7280" : agent.color} />
  </mesh>
  <AgentFace state={currentAnimState} personality={personality} />
  <AgentArms state={currentAnimState} walkProgress={walkProgressRef.current} personality={personality} />
</group>
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/objects/AgentModel.tsx
git commit -m "feat(virtual-office): add idle breathing animation to agents

Body scale Y oscillates ±1.5% on a 4-second cycle for subtle
breathing effect, always running regardless of state.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Active run faster typing

**Files:**
- Modify: `ui/src/features/virtual-office/objects/AgentModel.tsx`

- [ ] **Step 1: Apply 1.2x typeSpeed multiplier when agent has active run**

In `AgentArms` (or in `AgentModel` where it calls `AgentArms`), detect `hasActiveRun`:
```typescript
// In AgentModel render, pass hasActiveRun to AgentArms:
<AgentArms
  state={currentAnimState}
  walkProgress={walkProgressRef.current}
  personality={personality}
  isActiveRun={agent.hasActiveRun}
/>
```

Update `AgentArms` interface and typing oscillation:
```typescript
function AgentArms({ state, walkProgress, personality, isActiveRun }: {
  state: string;
  walkProgress: number;
  personality?: { armSwingAmplitude: number; typeSpeed: number };
  isActiveRun?: boolean;
})
```

In `AgentArms.useFrame` typing calculation:
```typescript
// BEFORE:
const oscillate = Math.sin(Date.now() * 0.008 * typeSpd) * 0.03;

// AFTER:
const activeMultiplier = isActiveRun ? 1.2 : 1.0;
const oscillate = Math.sin(Date.now() * 0.008 * typeSpd * activeMultiplier) * 0.03;
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/objects/AgentModel.tsx
git commit -m "feat(virtual-office): active run agents type 20% faster

When agent.hasActiveRun is true, typing oscillation speed increases
by 20% to convey active work intensity.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| `walkSpeed` parameter | Task 2 + Task 3 Step 3 |
| `armSwingAmplitude` parameter | Task 3 Step 5 |
| `typeSpeed` parameter | Task 3 Step 5 |
| `bobAmplitude` parameter | Task 2 + Task 3 Step 4 |
| `headSway` micro-movement | Task 3 Step 6 |
| Breathing animation | Task 4 |
| Active run faster typing | Task 5 |
| Seeding function | Task 1 |
| Layered animation (idle + state + situational) | Tasks 3-5 |

All spec requirements are covered.

---

## Post-Implementation Verification

After all tasks complete, verify by running the Vite dev server and checking:
1. Open Virtual Office preview (card click)
2. Compare two agents — their walking speeds should differ noticeably
3. Watch typing animation — one agent should oscillate faster/slower than another
4. All agents should show subtle idle breathing
5. With `hasActiveRun: true`, typing should be noticeably faster
