# Virtual Office Enhancement Design

**Date:** 2026-03-30
**Status:** Approved

## Overview

Enhance the Virtual Office 3D visualization with: smooth agent animations, rich hover/click interactions, and a modern office aesthetic upgrade. Three independent workstreams that compose together.

## 1. Architecture

```
VirtualOfficeCard
  └─ RetroOfficeScene (main R3F Canvas)
       ├─ CameraController (smooth camera lerping)
       ├─ ModernOfficeFurniture (upgraded desks, lighting, floor)
       ├─ AgentModel × N (animation state machine per agent)
       │    └─ AgentTooltip (hover, via @react-three/drei Html)
       └─ useOfficeAnimations (per-agent animation state machine)
```

**Files modified:**

| File | Change |
|------|--------|
| `ui/src/features/virtual-office/components/VirtualOfficeCard.tsx` | Add selected agent state, hover tooltip |
| `ui/src/features/virtual-office/scenes/RetroOfficeScene.tsx` | Add CameraController, AgentTooltip, wire useOfficeAnimations |
| `ui/src/features/virtual-office/objects/AgentModel.tsx` | Replace bob with animation state machine |
| `ui/src/features/virtual-office/core/mapAgentState.ts` | Emit previousState for transition detection |
| `ui/src/features/virtual-office/core/geometry.ts` | Wire up walkingPathForAgent |

**Files created:**

| File | Purpose |
|------|---------|
| `ui/src/features/virtual-office/hooks/useOfficeAnimations.ts` | Per-agent animation state machine |
| `ui/src/features/virtual-office/systems/CameraController.tsx` | Smooth camera target lerping |
| `ui/src/features/virtual-office/components/AgentTooltip.tsx` | Hover tooltip card |
| `ui/src/features/virtual-office/objects/ModernOfficeFurniture.tsx` | Modern desk + lamp + floor + wall geometry |

---

## 2. Animation State Machine

### States

```
IDLE ──► WALKING ──► SITTING
  ▲                    │
  │                    ▼
  └──── STANDING ◄─────┘
```

| State | Behavior |
|-------|----------|
| `idle` | Standing, subtle Y breathing bob (±0.01, 2s cycle) |
| `walking` | Lerp from current position to target desk over 800ms |
| `sitting` | At desk, typing bob (±0.02, 0.8s cycle) |
| `standing` | Brief stand-up pose before walking away (400ms) |

### Transitions

- `working` + not at desk → `walking` → `sitting`
- `working` + already at desk → direct `sitting`
- `away` / `standing` → `idle`
- Any state change triggers `walking` if position differs

### Implementation

```typescript
// useOfficeAnimations.ts
interface AgentAnimationState {
  id: string
  state: 'idle' | 'walking' | 'sitting' | 'standing'
  previousState: string
  progress: number // 0-1
  fromPosition: [number, number, number]
  toPosition: [number, number, number]
}
```

```typescript
// AgentModel.tsx - useFrame
useFrame((_, delta) => {
  if (animationState.state === 'walking') {
    const t = Math.min(1, animationState.progress + delta * 1.25)
    position.lerpVectors(fromPos, toPos, t)
    if (t >= 1) setState('sitting')
  }
})
```

### Camera Choreography

- Dialog opens → camera lerps from `[0, 12, 16]` to `[0, 6, 10]` over 1200ms
- Click agent → camera target lerps to agent's desk over 600ms
- Click empty space / Escape → camera returns to default over 600ms

---

## 3. Interaction Layer

### Hover Tooltip

- `@react-three/drei` `<Html>` rendered at agent world position (above head)
- Shows: agent name, role badge, current task (if working) or "Idle"
- 200ms hover delay, 150ms fade-in
- `distanceFactor={8}` for perspective scaling

```tsx
<Html position={[x, y + 1.5, z]} center distanceFactor={8}>
  <div className="agent-tooltip">
    <span className="agent-name">{agent.name}</span>
    <span className="agent-role">{agent.role}</span>
    <span className="agent-task">{taskName ?? 'Idle'}</span>
  </div>
</Html>
```

### Click-to-Focus

- Click agent → set selectedAgentId in parent state
- Camera smoothly tracks to frame the agent's desk
- Selected agent gets subtle highlight ring under desk
- Escape key or click void → deselect, camera returns home

### Desk Inspection

- Empty desks highlight on hover (outlines via `<Outlines>`)
- Click empty desk → "Desk X - Unoccupied" tooltip

### OrbitControls Constraints

- Polar angle: 10° to 80° (no underground)
- Azimuth: unlimited
- Smooth damping enabled (`enableDamping`, `dampingFactor=0.05`)

---

## 4. Modern Office Design

### Furniture Upgrade

Replace box-based furniture with styled geometry:

| Element | Geometry | Color/Material |
|---------|----------|----------------|
| Desk surface | Rounded box (2.2 × 0.05 × 1.2) | Warm oak `#D4A574` |
| Desk legs | Thin cylinders | Metallic gray |
| Monitor | Thin box with emissive screen | `#1E293B` body, `#3B82F6` glow |
| Desk lamp | Cone + sphere | `#FFF3E0` emissive warm |
| Chair | Rounded box seat + backrest | `#475569` dark slate |
| Floor | Large plane (30 × 30) | `#E8E4DF` with subtle grid |
| Back wall | Tall box | `#FAFAFA` off-white |
| Ceiling panels | Flat boxes with emissive | `#F5F5F4` with warm emissive |

### Lighting

| Light | Type | Color | Intensity |
|-------|------|-------|-----------|
| Ambient | ambientLight | `#FFF8F0` | 0.4 |
| Window | directionalLight | `#FFFAF0` | 0.8 |
| Per-desk lamp | pointLight | `#FFF3E0` | 0.3, distance 2 |
| Monitor glow | emissive material | `#3B82F6` | 0.2 |

### Post-Processing

Via `@react-three/postprocessing`:
- `Bloom`: threshold 0.8, intensity 0.3, radius 0.5 (subtle glow on emissives)
- `SSAO`: radius 0.1, intensity 0.5 (soft contact shadows)
- `Vignette`: darkness 0.3, offset 0.5

---

## 5. Dependencies

New packages needed:
- `@react-three/postprocessing` - Bloom, SSAO, Vignette
- `@react-three/drei` - already installed, use `<Html>`, `<Outlines>`, `<ContactShadows>`

Existing packages used:
- `@react-three/fiber` - Canvas, useFrame
- `three` - Vector3.lerp, geometry
- `@tanstack/react-query` - already used by useOfficeAgents

---

## 6. Performance Considerations

- `frameloop="demand"` in preview mode (low FPS)
- `frameloop="always"` only in full dialog view
- Agent tooltip Html rendered only for hovered agent (not all agents)
- Post-processing disabled in `quality="low"` preview
- Geometry instancing for repeated furniture (desks, chairs)
