# Virtual Office 3D — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3D Virtual Office to the AIDEVELO dashboard — a retro office scene where agents animate in real-time based on their status, lazy-loaded with an isolated Three.js vendor chunk.

**Architecture:** Three.js + React Three Fiber scene, selectively extracted from Claw3D. Lazy-loaded vendor chunk (`vendor-three`) keeps Three.js off the critical path. Real-time updates via existing React Query invalidation — no new WebSocket code. Mobile gets a 2D fallback.

**Tech Stack:** `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` (devDep); React 19, Vite, Radix Dialog, React Query, Tailwind CSS.

---

## Phase 0: Clone Claw3D Source

Before any implementation, clone the Claw3D repo to use as a reference/extraction source.

**Directory:** `../Claw3D/` (sibling to aidevelo, or a temp location)

- [ ] **Step 1: Clone Claw3D repo**

Run:
```bash
git clone https://github.com/iamlukethedev/Claw3D.git ../Claw3D
```

Expected: repo cloned, `src/features/retro-office/` contains `RetroOffice3D.tsx`, `agents.tsx`, `primitives.tsx`, `cameraLighting.tsx`.

---

## Phase 1: Dependencies & Config

### Task 1.1: Add Three.js Dependencies

**File:**
- Modify: `ui/package.json`

Add to `dependencies`:
```json
"three": "^0.183.2",
"@react-three/fiber": "^9.5.0",
"@react-three/drei": "^10.7.7"
```

Add to `devDependencies`:
```json
"@types/three": "^0.183.0"
```

- [ ] **Step 1: Add Three.js packages to ui/package.json**

```json
{
  "dependencies": {
    "three": "^0.183.2",
    "@react-three/fiber": "^9.5.0",
    "@react-three/drei": "^10.7.7"
  },
  "devDependencies": {
    "@types/three": "^0.183.0"
  }
}
```

- [ ] **Step 2: Run pnpm install**

Run: `cd ui && npm exec -- pnpm@9.15.4 -- install`
Expected: packages installed, no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/package.json ui/pnpm-lock.yaml
git commit -m "deps(ui): add three, @react-three/fiber, @react-three/drei"
```

---

### Task 1.2: Add Vendor Chunk to Vite Config

**File:**
- Modify: `ui/vite.config.ts`

Find the `manualChunks` function and add a `vendor-three` entry:

```ts
"vendor-three": ["three", "@react-three/fiber", "@react-three/drei"],
```

- [ ] **Step 1: Add vendor-three manual chunk**

Locate the `manualChunks` function in `vite.config.ts`. Add:
```ts
"vendor-three": ["three", "@react-three/fiber", "@react-three/drei"],
```

- [ ] **Step 2: Verify chunk isolation with build**

Run: `cd ui && npm exec -- vite@5 build 2>&1 | findstr "vendor-three"`
Expected: build succeeds and `vendor-three` chunk appears in output.

- [ ] **Step 3: Commit**

```bash
git add ui/vite.config.ts
git commit -m "perf(ui): isolate three.js into vendor-three chunk"
```

---

## Phase 2: Core Types & Constants

### Task 2.1: Create Core Types

**File:**
- Create: `ui/src/features/virtual-office/core/types.ts`

```ts
export type OfficeAgentState = "working" | "standing" | "walking" | "away" | "error";

export interface OfficeAgent {
  id: string;
  name: string;
  state: OfficeAgentState;
  color: string;       // hex color for the agent's avatar
  deskIndex: number;    // which desk position they occupy
  hasActiveRun: boolean;
  role: string;         // original AIDEVELO role
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/core/types.ts**

```ts
export type OfficeAgentState = "working" | "standing" | "walking" | "away" | "error";

export interface OfficeAgent {
  id: string;
  name: string;
  state: OfficeAgentState;
  color: string;
  deskIndex: number;
  hasActiveRun: boolean;
  role: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/core/types.ts
git commit -m "feat(virtual-office): add core types"
```

---

### Task 2.2: Create Constants

**File:**
- Create: `ui/src/features/virtual-office/core/constants.ts`

```ts
// Desk layout zones by role priority (lower = closer to premium)
export const ROLE_DESK_ZONE: Record<string, number> = {
  ceo: 0,
  cto: 1,
  cpo: 1,
  head_of: 1,
  engineer: 2,
  developer: 2,
  designer: 2,
  default: 3,
};

export const AGENT_COLORS: Record<string, string> = {
  ceo: "#F59E0B",    // amber/gold
  cto: "#06B6D4",    // cyan
  cpo: "#8B5CF6",    // violet
  head_of: "#EC4899", // pink
  engineer: "#10B981", // emerald
  developer: "#10B981",
  designer: "#F97316", // orange
  default: "#6B7280",  // gray
};

export const FPS = {
  PREVIEW: 10,
  HIGH: 30,
} as const;

export const QUALITY_DPR = {
  low: 1,
  medium: 1.5,
  high: 2,
} as const;
```

- [ ] **Step 1: Create ui/src/features/virtual-office/core/constants.ts**

```ts
export const ROLE_DESK_ZONE: Record<string, number> = {
  ceo: 0,
  cto: 1,
  cpo: 1,
  head_of: 1,
  engineer: 2,
  developer: 2,
  designer: 2,
  default: 3,
};

export const AGENT_COLORS: Record<string, string> = {
  ceo: "#F59E0B",
  cto: "#06B6D4",
  cpo: "#8B5CF6",
  head_of: "#EC4899",
  engineer: "#10B981",
  developer: "#10B981",
  designer: "#F97316",
  default: "#6B7280",
};

export const FPS = {
  PREVIEW: 10,
  HIGH: 30,
} as const;

export const QUALITY_DPR = {
  low: 1,
  medium: 1.5,
  high: 2,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/core/constants.ts
git commit -m "feat(virtual-office): add constants and role desk zones"
```

---

### Task 2.3: Create Agent State Mapper

**File:**
- Create: `ui/src/features/virtual-office/core/mapAgentState.ts`

This is the bridge between AIDEVELO agent data and `OfficeAgent`.

```ts
import type { Agent, LiveRun } from "@/types";
import { OfficeAgent, OfficeAgentState } from "./types";
import { ROLE_DESK_ZONE, AGENT_COLORS } from "./constants";

function getAgentState(agent: Agent, liveRun: LiveRun | undefined): OfficeAgentState {
  if (agent.status === "error") return "error";
  if (agent.status === "paused") return "away";
  if (liveRun) return "working";
  if (agent.status === "running") return "standing";
  if (agent.status === "idle") return "walking";
  if (agent.status === "pending_approval") return "standing";
  return "standing";
}

function roleToColor(role: string): string {
  return AGENT_COLORS[role.toLowerCase()] ?? AGENT_COLORS.default;
}

export function mapAgentToOffice(
  agent: Agent,
  liveRun: LiveRun | undefined,
  deskIndex: number
): OfficeAgent {
  return {
    id: agent.id,
    name: agent.name,
    state: getAgentState(agent, liveRun),
    color: roleToColor(agent.role ?? "default"),
    deskIndex,
    hasActiveRun: !!liveRun,
    role: agent.role ?? "default",
  };
}

export function assignDeskIndices(agents: OfficeAgent[]): OfficeAgent[] {
  const sorted = [...agents].sort(
    (a, b) => (ROLE_DESK_ZONE[a.role] ?? 99) - (ROLE_DESK_ZONE[b.role] ?? 99)
  );
  return sorted.map((agent, i) => ({ ...agent, deskIndex: i }));
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/core/mapAgentState.ts**

```ts
import type { Agent, LiveRun } from "@/types";
import { OfficeAgent, OfficeAgentState } from "./types";
import { ROLE_DESK_ZONE, AGENT_COLORS } from "./constants";

function getAgentState(agent: Agent, liveRun: LiveRun | undefined): OfficeAgentState {
  if (agent.status === "error") return "error";
  if (agent.status === "paused") return "away";
  if (liveRun) return "working";
  if (agent.status === "running") return "standing";
  if (agent.status === "idle") return "walking";
  if (agent.status === "pending_approval") return "standing";
  return "standing";
}

function roleToColor(role: string): string {
  return AGENT_COLORS[role.toLowerCase()] ?? AGENT_COLORS.default;
}

export function mapAgentToOffice(
  agent: Agent,
  liveRun: LiveRun | undefined,
  deskIndex: number
): OfficeAgent {
  return {
    id: agent.id,
    name: agent.name,
    state: getAgentState(agent, liveRun),
    color: roleToColor(agent.role ?? "default"),
    deskIndex,
    hasActiveRun: !!liveRun,
    role: agent.role ?? "default",
  };
}

export function assignDeskIndices(agents: OfficeAgent[]): OfficeAgent[] {
  const sorted = [...agents].sort(
    (a, b) => (ROLE_DESK_ZONE[a.role] ?? 99) - (ROLE_DESK_ZONE[b.role] ?? 99)
  );
  return sorted.map((agent, i) => ({ ...agent, deskIndex: i }));
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/core/mapAgentState.ts
git commit -m "feat(virtual-office): add agent state mapper with role-based desk assignment"
```

---

### Task 2.4: Create Geometry Helpers

**File:**
- Create: `ui/src/features/virtual-office/core/geometry.ts`

Coordinate transforms adapted from Claw3D. These convert desk index → 3D world position.

```ts
// Desk grid layout: rows × columns
const GRID_COLS = 4;
const DESK_SPACING_X = 2.5;
const DESK_SPACING_Z = 2.5;
const GRID_ORIGIN_X = -(GRID_COLS * DESK_SPACING_X) / 2;

export function deskIndexToWorld(deskIndex: number): [number, number, number] {
  const row = Math.floor(deskIndex / GRID_COLS);
  const col = deskIndex % GRID_COLS;
  return [
    GRID_ORIGIN_X + col * DESK_SPACING_X,
    0, // Y stays at floor level; agent models handle vertical offset
    -2 + row * DESK_SPACING_Z,
  ];
}

export function walkingPathForAgent(agentId: string): [number, number, number][] {
  // Return a simple looping path for idle agents
  const seed = agentId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const cx = (seed % 6) - 3;
  return [
    [cx, 0, 1],
    [cx + 1, 0, 2],
    [cx, 0, 3],
    [cx - 1, 0, 2],
  ];
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/core/geometry.ts**

```ts
const GRID_COLS = 4;
const DESK_SPACING_X = 2.5;
const DESK_SPACING_Z = 2.5;
const GRID_ORIGIN_X = -(GRID_COLS * DESK_SPACING_X) / 2;

export function deskIndexToWorld(deskIndex: number): [number, number, number] {
  const row = Math.floor(deskIndex / GRID_COLS);
  const col = deskIndex % GRID_COLS;
  return [
    GRID_ORIGIN_X + col * DESK_SPACING_X,
    0,
    -2 + row * DESK_SPACING_Z,
  ];
}

export function walkingPathForAgent(agentId: string): [number, number, number][] {
  const seed = agentId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const cx = (seed % 6) - 3;
  return [
    [cx, 0, 1],
    [cx + 1, 0, 2],
    [cx, 0, 3],
    [cx - 1, 0, 2],
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/core/geometry.ts
git commit -m "feat(virtual-office): add geometry helpers for desk positions"
```

---

## Phase 3: 3D Objects (from Claw3D)

**Note:** These components are extracted from Claw3D. The code below is the target interface — actual mesh geometry should be adapted from the Claw3D primitives and agents source files.

### Task 3.1: Create OfficeFurniture

**File:**
- Create: `ui/src/features/virtual-office/objects/OfficeFurniture.tsx`

```tsx
import { useMemo } from "react";
import * as THREE from "three";

interface FurnitureProps {
  theme?: "dark" | "light";
}

function Desk({ position, theme }: { position: [number, number, number]; theme?: "dark" | "light" }) {
  const color = theme === "dark" ? "#1F2937" : "#D1D5DB";
  return (
    <group position={position}>
      {/* Desk top */}
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.05, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Desk legs */}
      {[[-0.5, 0, -0.25], [0.5, 0, -0.25], [-0.5, 0, 0.25], [0.5, 0, 0.25]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.05, 0.7, 0.05]} />
          <meshStandardMaterial color={theme === "dark" ? "#374151" : "#9CA3AF"} />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, 0.9, -0.2]}>
        <boxGeometry args={[0.5, 0.35, 0.02]} />
        <meshStandardMaterial color="#111827" emissive="#3B82F6" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Chair({ position, theme }: { position: [number, number, number]; theme?: "dark" | "light" }) {
  const seatColor = theme === "dark" ? "#4B5563" : "#E5E7EB";
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color={seatColor} />
      </mesh>
      <mesh position={[0, 0.65, -0.18]} castShadow>
        <boxGeometry args={[0.4, 0.45, 0.03]} />
        <meshStandardMaterial color={seatColor} />
      </mesh>
    </group>
  );
}

export function OfficeFurniture({ theme = "dark" }: FurnitureProps) {
  const desks = useMemo(() => {
    const result: [number, number, number][] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        result.push([(col - 1.5) * 2.5, 0, row * 2.5 - 2]);
      }
    }
    return result;
  }, []);

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={theme === "dark" ? "#1F2937" : "#E5E7EB"} />
      </mesh>
      {/* Walls */}
      <mesh position={[0, 2, -5]} receiveShadow>
        <boxGeometry args={[15, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      <mesh position={[-7.5, 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      <mesh position={[7.5, 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      {/* Desks */}
      {desks.map((pos, i) => (
        <Desk key={i} position={pos} theme={theme} />
      ))}
      {/* Chairs (slightly in front of each desk) */}
      {desks.map((pos, i) => (
        <Chair key={`chair-${i}`} position={[pos[0], pos[1], pos[2] + 0.8]} theme={theme} />
      ))}
    </group>
  );
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/objects/OfficeFurniture.tsx**

```tsx
import { useMemo } from "react";
import * as THREE from "three";

interface FurnitureProps {
  theme?: "dark" | "light";
}

function Desk({ position, theme }: { position: [number, number, number]; theme?: "dark" | "light" }) {
  const color = theme === "dark" ? "#1F2937" : "#D1D5DB";
  return (
    <group position={position}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.05, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[[-0.5, 0, -0.25], [0.5, 0, -0.25], [-0.5, 0, 0.25], [0.5, 0, 0.25]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.05, 0.7, 0.05]} />
          <meshStandardMaterial color={theme === "dark" ? "#374151" : "#9CA3AF"} />
        </mesh>
      ))}
      <mesh position={[0, 0.9, -0.2]}>
        <boxGeometry args={[0.5, 0.35, 0.02]} />
        <meshStandardMaterial color="#111827" emissive="#3B82F6" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Chair({ position, theme }: { position: [number, number, number]; theme?: "dark" | "light" }) {
  const seatColor = theme === "dark" ? "#4B5563" : "#E5E7EB";
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color={seatColor} />
      </mesh>
      <mesh position={[0, 0.65, -0.18]} castShadow>
        <boxGeometry args={[0.4, 0.45, 0.03]} />
        <meshStandardMaterial color={seatColor} />
      </mesh>
    </group>
  );
}

export function OfficeFurniture({ theme = "dark" }: FurnitureProps) {
  const desks = useMemo(() => {
    const result: [number, number, number][] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        result.push([(col - 1.5) * 2.5, 0, row * 2.5 - 2]);
      }
    }
    return result;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={theme === "dark" ? "#1F2937" : "#E5E7EB"} />
      </mesh>
      <mesh position={[0, 2, -5]} receiveShadow>
        <boxGeometry args={[15, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      <mesh position={[-7.5, 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      <mesh position={[7.5, 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[10, 4, 0.2]} />
        <meshStandardMaterial color={theme === "dark" ? "#111827" : "#D1D5DB"} />
      </mesh>
      {desks.map((pos, i) => (
        <Desk key={i} position={pos} theme={theme} />
      ))}
      {desks.map((pos, i) => (
        <Chair key={`chair-${i}`} position={[pos[0], pos[1], pos[2] + 0.8]} theme={theme} />
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/objects/OfficeFurniture.tsx
git commit -m "feat(virtual-office): add OfficeFurniture with desks and chairs"
```

---

### Task 3.2: Create AgentModel

**File:**
- Create: `ui/src/features/virtual-office/objects/AgentModel.tsx`

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OfficeAgent } from "../core/types";
import { deskIndexToWorld } from "../core/geometry";

interface AgentModelProps {
  agent: OfficeAgent;
}

function AgentBody({ color, isWorking }: { color: string; isWorking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (isWorking) {
      // Subtle typing bob
      groupRef.current.position.y = Math.sin(Date.now() * 0.005) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function ErrorGlow({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
    }
  });
  return (
    <mesh ref={meshRef} position={[0, 0.8, 0]}>
      <sphereGeometry args={[0.4, 8, 8]} />
      <meshStandardMaterial color={color} emissive="#EF4444" emissiveIntensity={1} transparent opacity={0.3} />
    </mesh>
  );
}

export function AgentModel({ agent }: AgentModelProps) {
  const [x, y, z] = deskIndexToWorld(agent.deskIndex);
  const isWorking = agent.state === "working";
  const isError = agent.state === "error";
  const isAway = agent.state === "away";

  return (
    <group position={[x, y, z]}>
      <AgentBody color={isAway ? "#6B7280" : agent.color} isWorking={isWorking} />
      {isError && <ErrorGlow color={agent.color} />}
      {/* Name label via drei Text */}
    </group>
  );
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/objects/AgentModel.tsx**

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OfficeAgent } from "../core/types";
import { deskIndexToWorld } from "../core/geometry";

interface AgentModelProps {
  agent: OfficeAgent;
}

function AgentBody({ color, isWorking }: { color: string; isWorking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    if (isWorking) {
      groupRef.current.position.y = Math.sin(Date.now() * 0.005) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function ErrorGlow({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
    }
  });
  return (
    <mesh ref={meshRef} position={[0, 0.8, 0]}>
      <sphereGeometry args={[0.4, 8, 8]} />
      <meshStandardMaterial color={color} emissive="#EF4444" emissiveIntensity={1} transparent opacity={0.3} />
    </mesh>
  );
}

export function AgentModel({ agent }: AgentModelProps) {
  const [x, y, z] = deskIndexToWorld(agent.deskIndex);
  const isWorking = agent.state === "working";
  const isError = agent.state === "error";
  const isAway = agent.state === "away";

  return (
    <group position={[x, y, z]}>
      <AgentBody color={isAway ? "#6B7280" : agent.color} isWorking={isWorking} />
      {isError && <ErrorGlow color={agent.color} />}
    </group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/objects/AgentModel.tsx
git commit -m "feat(virtual-office): add AgentModel with working/error/away states"
```

---

### Task 3.3: Create CameraLighting

**File:**
- Create: `ui/src/features/virtual-office/systems/CameraLighting.tsx`

```tsx
import { useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface CameraLightingProps {
  theme?: "dark" | "light";
}

export function CameraLighting({ theme = "dark" }: CameraLightingProps) {
  const isDark = theme === "dark";
  const ambientIntensity = isDark ? 0.3 : 0.8;
  const ambientColor = isDark ? "#1E293B" : "#F3F4F6";
  const directionalIntensity = isDark ? 0.5 : 1.2;
  const directionalColor = isDark ? "#818CF8" : "#FDE68A"; // neon-ish for dark, warm for light

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={directionalIntensity}
        color={directionalColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {isDark && (
        <>
          <pointLight position={[-3, 2, 0]} color="#3B82F6" intensity={0.5} />
          <pointLight position={[3, 2, 0]} color="#8B5CF6" intensity={0.5} />
        </>
      )}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={20}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/systems/CameraLighting.tsx**

```tsx
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface CameraLightingProps {
  theme?: "dark" | "light";
}

export function CameraLighting({ theme = "dark" }: CameraLightingProps) {
  const isDark = theme === "dark";
  const ambientIntensity = isDark ? 0.3 : 0.8;
  const ambientColor = isDark ? "#1E293B" : "#F3F4F6";
  const directionalIntensity = isDark ? 0.5 : 1.2;
  const directionalColor = isDark ? "#818CF8" : "#FDE68A";

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={directionalIntensity}
        color={directionalColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {isDark && (
        <>
          <pointLight position={[-3, 2, 0]} color="#3B82F6" intensity={0.5} />
          <pointLight position={[3, 2, 0]} color="#8B5CF6" intensity={0.5} />
        </>
      )}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={20}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/systems/CameraLighting.tsx
git commit -m "feat(virtual-office): add CameraLighting with theme-aware neon accents"
```

---

### Task 3.4: Create RetroOfficeScene

**File:**
- Create: `ui/src/features/virtual-office/scenes/RetroOfficeScene.tsx`

```tsx
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { OfficeAgent } from "../core/types";
import { OfficeFurniture } from "../objects/OfficeFurniture";
import { AgentModel } from "../objects/AgentModel";
import { CameraLighting } from "../systems/CameraLighting";
import { FPS, QUALITY_DPR } from "../core/constants";

interface RetroOfficeSceneProps {
  agents: OfficeAgent[];
  theme?: "dark" | "light";
  quality?: "low" | "medium" | "high";
  maxFps?: number;
  onAgentClick?: (agentId: string) => void;
}

export function RetroOfficeScene({
  agents,
  theme = "dark",
  quality = "high",
  maxFps = FPS.HIGH,
  onAgentClick,
}: RetroOfficeSceneProps) {
  const dpr = QUALITY_DPR[quality];
  const enableShadows = quality !== "low";

  return (
    <Canvas
      dpr={dpr}
      shadows={enableShadows}
      camera={{ position: [0, 6, 10], fov: 50 }}
      frameloop={maxFps < FPS.HIGH ? "demand" : "always"}
      style={{ width: "100%", height: "100%", background: theme === "dark" ? "#0F172A" : "#F8FAFC" }}
    >
      <Suspense fallback={null}>
        <CameraLighting theme={theme} />
        <OfficeFurniture theme={theme} />
        {agents.map((agent) => (
          <group
            key={agent.id}
            onClick={() => onAgentClick?.(agent.id)}
            style={{ cursor: "pointer" }}
          >
            <AgentModel agent={agent} />
          </group>
        ))}
        {agents.length === 0 && (
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#6B7280" />
          </mesh>
        )}
      </Suspense>
    </Canvas>
  );
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/scenes/RetroOfficeScene.tsx**

```tsx
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import type { OfficeAgent } from "../core/types";
import { OfficeFurniture } from "../objects/OfficeFurniture";
import { AgentModel } from "../objects/AgentModel";
import { CameraLighting } from "../systems/CameraLighting";
import { FPS, QUALITY_DPR } from "../core/constants";

interface RetroOfficeSceneProps {
  agents: OfficeAgent[];
  theme?: "dark" | "light";
  quality?: "low" | "medium" | "high";
  maxFps?: number;
  onAgentClick?: (agentId: string) => void;
}

export function RetroOfficeScene({
  agents,
  theme = "dark",
  quality = "high",
  maxFps = FPS.HIGH,
  onAgentClick,
}: RetroOfficeSceneProps) {
  const dpr = QUALITY_DPR[quality];
  const enableShadows = quality !== "low";

  return (
    <Canvas
      dpr={dpr}
      shadows={enableShadows}
      camera={{ position: [0, 6, 10], fov: 50 }}
      frameloop={maxFps < FPS.HIGH ? "demand" : "always"}
      style={{ width: "100%", height: "100%", background: theme === "dark" ? "#0F172A" : "#F8FAFC" }}
    >
      <Suspense fallback={null}>
        <CameraLighting theme={theme} />
        <OfficeFurniture theme={theme} />
        {agents.map((agent) => (
          <group
            key={agent.id}
            onClick={() => onAgentClick?.(agent.id)}
            style={{ cursor: "pointer" }}
          >
            <AgentModel agent={agent} />
          </group>
        ))}
        {agents.length === 0 && (
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#6B7280" />
          </mesh>
        )}
      </Suspense>
    </Canvas>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/scenes/RetroOfficeScene.tsx
git commit -m "feat(virtual-office): add RetroOfficeScene with R3F Canvas"
```

---

## Phase 4: Data Hook

### Task 4.1: Create useOfficeAgents Hook

**File:**
- Create: `ui/src/features/virtual-office/hooks/useOfficeAgents.ts`

```ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import type { Agent, LiveRun } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { mapAgentToOffice, assignDeskIndices } from "../core/mapAgentState";

interface UseOfficeAgentsOptions {
  companyId: string | null;
}

export function useOfficeAgents({ companyId }: UseOfficeAgentsOptions) {
  const { data: agents = [] } = useQuery({
    ...queryKeys.agents.list(companyId),
    enabled: !!companyId,
  });

  const { data: liveRuns = [] } = useQuery({
    ...queryKeys.liveRuns(companyId),
    enabled: !!companyId,
  });

  const officeAgents = useMemo(() => {
    const liveRunMap = new Map<string, LiveRun>(
      liveRuns.map((run) => [run.agentId, run])
    );

    const mapped = (agents as Agent[])
      .filter((a) => a.status !== "terminated")
      .map((agent) => mapAgentToOffice(agent, liveRunMap.get(agent.id), 0));

    return assignDeskIndices(mapped);
  }, [agents, liveRuns]);

  return { officeAgents };
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/hooks/useOfficeAgents.ts**

```ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent, LiveRun } from "@/types";
import { queryKeys } from "@/lib/queryKeys";
import { mapAgentToOffice, assignDeskIndices } from "../core/mapAgentState";

interface UseOfficeAgentsOptions {
  companyId: string | null;
}

export function useOfficeAgents({ companyId }: UseOfficeAgentsOptions) {
  const { data: agents = [] } = useQuery({
    ...queryKeys.agents.list(companyId),
    enabled: !!companyId,
  });

  const { data: liveRuns = [] } = useQuery({
    ...queryKeys.liveRuns(companyId),
    enabled: !!companyId,
  });

  const officeAgents = useMemo(() => {
    const liveRunMap = new Map<string, LiveRun>(
      liveRuns.map((run) => [run.agentId, run])
    );

    const mapped = (agents as Agent[])
      .filter((a) => a.status !== "terminated")
      .map((agent) => mapAgentToOffice(agent, liveRunMap.get(agent.id), 0));

    return assignDeskIndices(mapped);
  }, [agents, liveRuns]);

  return { officeAgents };
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/hooks/useOfficeAgents.ts
git commit -m "feat(virtual-office): add useOfficeAgents React Query hook"
```

---

## Phase 5: Dashboard Components

### Task 5.1: Create VirtualOfficeCard

**File:**
- Create: `ui/src/features/virtual-office/components/VirtualOfficeCard.tsx`

```tsx
import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "@/hooks/useTheme";
import { useSidebar } from "@/hooks/useSidebar";
import { useOfficeAgents } from "../hooks/useOfficeAgents";
import { FPS } from "../core/constants";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RetroOfficeScene } from "../scenes/RetroOfficeScene";

const VirtualOfficeCard = lazy(() =>
  import("@/features/virtual-office").then((m) => ({ default: m.VirtualOfficeCard as unknown as React.ComponentType<{ companyId: string }> }))
);

interface VirtualOfficeCardProps {
  companyId: string;
}

export function VirtualOfficeCard({ companyId }: VirtualOfficeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();
  const { isMobile } = useSidebar();
  const { officeAgents } = useOfficeAgents({ companyId });
  const cardRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver gating (same pattern as LightRays.tsx)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // localStorage preference
  const [hidden, setHidden] = useState(() => {
    return localStorage.getItem("aidevelo:virtual-office-visible") === "hidden";
  });

  if (hidden) return null;

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
  };

  const handleClose = () => {
    setExpanded(false);
  };

  const handleAgentClick = (agentId: string) => {
    setExpanded(false);
    navigate(`/agents/${agentId}`);
  };

  if (isMobile) {
    return <VirtualOfficeFallback agents={officeAgents} />;
  }

  return (
    <>
      <div
        ref={cardRef}
        className="relative rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Virtual Office</h3>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {officeAgents.length} agent{officeAgents.length !== 1 ? "s" : ""}
          </span>
        </div>
        {visible && (
          <Suspense fallback={<div className="h-[120px] bg-muted/50 rounded-lg animate-pulse" />}>
            <RetroOfficeScene
              agents={officeAgents.slice(0, 4)}
              theme={theme === "dark" ? "dark" : "light"}
              quality="low"
              maxFps={FPS.PREVIEW}
            />
          </Suspense>
        )}
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={handleToggle}>
          View Office
        </Button>
      </div>

      <Dialog open={expanded} onOpenChange={handleClose}>
        <DialogContent className="max-w-[95vw] h-[85vh] p-0 overflow-hidden">
          <RetroOfficeScene
            agents={officeAgents}
            theme={theme === "dark" ? "dark" : "light"}
            quality="high"
            maxFps={FPS.HIGH}
            onAgentClick={handleAgentClick}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Mobile fallback component
function VirtualOfficeFallback({ agents }: { agents: ReturnType<typeof useOfficeAgents>["officeAgents"] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">Agents</h3>
      <div className="grid grid-cols-2 gap-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted transition-colors text-left"
            onClick={() => navigate(`/agents/${agent.id}`)}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: agent.color }}
            />
            <span className="text-xs truncate">{agent.name}</span>
            <span className="text-xs text-muted-foreground ml-auto capitalize">{agent.state}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Create ui/src/features/virtual-office/components/VirtualOfficeCard.tsx**

```tsx
import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "@/hooks/useTheme";
import { useSidebar } from "@/hooks/useSidebar";
import { useOfficeAgents } from "../hooks/useOfficeAgents";
import { FPS } from "../core/constants";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RetroOfficeScene } from "../scenes/RetroOfficeScene";

interface VirtualOfficeCardProps {
  companyId: string;
}

export function VirtualOfficeCard({ companyId }: VirtualOfficeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();
  const { isMobile } = useSidebar();
  const { officeAgents } = useOfficeAgents({ companyId });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [hidden] = useState(() =>
    localStorage.getItem("aidevelo:virtual-office-visible") === "hidden"
  );

  if (hidden) return null;

  const handleToggle = () => setExpanded((v) => !v);
  const handleClose = () => setExpanded(false);
  const handleAgentClick = (agentId: string) => {
    setExpanded(false);
    navigate(`/agents/${agentId}`);
  };

  if (isMobile) {
    return <VirtualOfficeFallback agents={officeAgents} />;
  }

  return (
    <>
      <div
        ref={cardRef}
        className="relative rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Virtual Office</h3>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {officeAgents.length} agent{officeAgents.length !== 1 ? "s" : ""}
          </span>
        </div>
        {visible && (
          <Suspense fallback={<div className="h-[120px] bg-muted/50 rounded-lg animate-pulse" />}>
            <RetroOfficeScene
              agents={officeAgents.slice(0, 4)}
              theme={theme === "dark" ? "dark" : "light"}
              quality="low"
              maxFps={FPS.PREVIEW}
            />
          </Suspense>
        )}
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={handleToggle}>
          View Office
        </Button>
      </div>

      <Dialog open={expanded} onOpenChange={handleClose}>
        <DialogContent className="max-w-[95vw] h-[85vh] p-0 overflow-hidden">
          <RetroOfficeScene
            agents={officeAgents}
            theme={theme === "dark" ? "dark" : "light"}
            quality="high"
            maxFps={FPS.HIGH}
            onAgentClick={handleAgentClick}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function VirtualOfficeFallback({ agents }: { agents: ReturnType<typeof useOfficeAgents>["officeAgents"] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">Agents</h3>
      <div className="grid grid-cols-2 gap-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted transition-colors text-left"
            onClick={() => navigate(`/agents/${agent.id}`)}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: agent.color }}
            />
            <span className="text-xs truncate">{agent.name}</span>
            <span className="text-xs text-muted-foreground ml-auto capitalize">{agent.state}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/components/VirtualOfficeCard.tsx
git commit -m "feat(virtual-office): add VirtualOfficeCard with preview and dialog"
```

---

### Task 5.2: Create Barrel Index

**File:**
- Create: `ui/src/features/virtual-office/index.ts`

```ts
export { VirtualOfficeCard } from "./components/VirtualOfficeCard";
export { RetroOfficeScene } from "./scenes/RetroOfficeScene";
export type { OfficeAgent, OfficeAgentState } from "./core/types";
```

- [ ] **Step 1: Create ui/src/features/virtual-office/index.ts**

```ts
export { VirtualOfficeCard } from "./components/VirtualOfficeCard";
export { RetroOfficeScene } from "./scenes/RetroOfficeScene";
export type { OfficeAgent, OfficeAgentState } from "./core/types";
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/features/virtual-office/index.ts
git commit -m "feat(virtual-office): add barrel export"
```

---

## Phase 6: Dashboard Integration

### Task 6.1: Wire into Dashboard

**File:**
- Modify: `ui/src/pages/Dashboard.tsx`

Find where `ActiveAgentsPanel` is rendered (around line 209). Insert the lazy VirtualOfficeCard between it and the metrics grid.

Add the lazy import near the top with other lazy imports:
```tsx
const VirtualOfficeCard = lazy(() =>
  import("@/features/virtual-office").then((m) => ({ default: m.VirtualOfficeCard }))
);
```

Add in JSX between `ActiveAgentsPanel` and the metrics grid:
```tsx
<Suspense fallback={null}>
  {selectedCompanyId && <VirtualOfficeCard companyId={selectedCompanyId} />}
</Suspense>
```

- [ ] **Step 1: Add lazy import of VirtualOfficeCard to Dashboard.tsx**

Locate the `lazy` imports at the top of `Dashboard.tsx`. Add:
```tsx
const VirtualOfficeCard = lazy(() =>
  import("@/features/virtual-office").then((m) => ({ default: m.VirtualOfficeCard }))
);
```

- [ ] **Step 2: Insert VirtualOfficeCard between ActiveAgentsPanel and metrics**

Find the `ActiveAgentsPanel` component in the JSX (around line 209). Add after it:
```tsx
<Suspense fallback={null}>
  {selectedCompanyId && <VirtualOfficeCard companyId={selectedCompanyId} />}
</Suspense>
```

- [ ] **Step 3: Commit**

```bash
git add ui/src/pages/Dashboard.tsx
git commit -m "feat(dashboard): integrate VirtualOfficeCard between agents and metrics"
```

---

## Phase 7: Final Verification

### Task 7.1: TypeScript Check

- [ ] **Run TypeScript check**

Run: `cd ui && npm exec -- tsc --noEmit 2>&1`
Expected: No errors (ignoring pre-existing Express req.actor typing issues).

### Task 7.2: Build Verification

- [ ] **Verify vendor-three chunk**

Run: `cd ui && npm exec -- vite@5 build 2>&1`
Expected: `vendor-three` chunk is present in dist/assets/.

### Task 7.3: Dev Server Smoke Test

- [ ] **Start dev server and check dashboard loads**

Run: `curl http://localhost:3100/api/health`
Expected: `{"ok":true,...}`

Navigate to `http://localhost:3100` — Virtual Office card should appear between `ActiveAgentsPanel` and metrics.

---

## Self-Review Checklist

- [ ] All 7 phases covered with tasks
- [ ] Each task has exact file paths
- [ ] Each code step has actual code (no placeholders)
- [ ] Type consistency verified: `OfficeAgent` fields match between `types.ts`, `mapAgentState.ts`, `AgentModel.tsx`, `RetroOfficeScene.tsx`, and `useOfficeAgents.ts`
- [ ] `FPS` and `QUALITY_DPR` constants referenced consistently
- [ ] Theme awareness: dark/light prop flows from `VirtualOfficeCard` → `RetroOfficeScene` → `CameraLighting`/`OfficeFurniture`
- [ ] WebGL cleanup pattern not yet implemented (defer to later if issues arise)
