# Virtual Office 3D — Implementation Plan

## Context

AIDEVELO users have no visual way to see their AI agents "at work" — the dashboard shows metrics and text-based activity logs. Adding a 3D Virtual Office powered by Claw3D (Three.js + React Three Fiber) gives users a live, interactive view of their agents in a retro office environment. Agents animate based on real-time status via the existing WebSocket event system.

---

## Architecture Summary

```
Dashboard.tsx
  └─ <Suspense> (lazy-loaded, zero impact on initial load)
       └─ VirtualOfficeCard (collapsed preview OR expanded dialog)
             ├─ useOfficeAgents() hook ── React Query (agents + liveRuns)
             │      ↑ auto-invalidated by LiveUpdatesProvider via WebSocket
             └─ RetroOfficeScene (R3F Canvas)
                  ├─ AgentModel[] (extracted from Claw3D)
                  ├─ OfficeFurniture (extracted from Claw3D)
                  └─ CameraLighting (extracted from Claw3D)
```

**Key Decisions:**
- **Selective extraction** from Claw3D — only the 3D rendering layer, no Next.js/Phaser
- **Radix Dialog overlay** for expanded view (consistent with existing modals)
- **Lazy-loaded vendor chunk** for Three.js (~600KB isolated)
- **Mobile: 2D fallback** — no Three.js loaded on `isMobile`
- **No new WebSocket code** — piggybacks on existing React Query invalidation

---

## File Structure

```
ui/src/features/virtual-office/
  core/
    types.ts              — OfficeAgent type, state enums
    constants.ts          — Scale, timing, color constants
    geometry.ts           — Coordinate transforms (from Claw3D)
    mapAgentState.ts      — AIDEVELO Agent → OfficeAgent mapper
  objects/
    AgentModel.tsx        — 3D agent model + animations (from Claw3D agents.tsx)
    OfficeFurniture.tsx   — Desks, chairs, instanced geometry (from Claw3D primitives.tsx)
  systems/
    CameraLighting.tsx    — OrbitControls + DayNight lighting (from Claw3D)
  scenes/
    RetroOfficeScene.tsx  — Main R3F Canvas scene (adapted RetroOffice3D.tsx)
  components/
    VirtualOfficeCard.tsx       — Dashboard card (preview + dialog trigger)
    VirtualOfficeDialog.tsx     — Expanded fullscreen dialog
    VirtualOfficeFallback.tsx   — 2D mobile fallback grid
  hooks/
    useOfficeAgents.ts    — React Query → OfficeAgent[] bridge
  index.ts                — Barrel export for lazy loading
```

**Files to Modify:**
| File | Change |
|------|--------|
| `ui/package.json` | Add `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` |
| `ui/vite.config.ts` | Add `"vendor-three"` manual chunk |
| `ui/src/pages/Dashboard.tsx` | Insert lazy `<VirtualOfficeCard>` between ActiveAgentsPanel and metrics |

---

## Agent State Mapping

| AIDEVELO Status | 3D State | Visual |
|----------------|----------|--------|
| `running` (live run active) | `working` | Sitting at desk, typing animation |
| `active` (no live run) | `standing` | Standing near desk |
| `idle` | `walking` | Walking around office |
| `paused` | `away` | Frozen/grayed out at desk |
| `error` | `error` | Red pulsing glow |
| `pending_approval` | `standing` | Standing with yellow indicator |
| `terminated` | *(excluded)* | Not rendered |

---

## Phase 1: Foundation — Dependencies & Types

1. **Install deps** in `ui/package.json`:
   - `three@^0.183.2`, `@react-three/fiber@^9.5.0`, `@react-three/drei@^10.7.7`
   - `@types/three@^0.183.0` (devDep)

2. **Add vendor chunk** in `ui/vite.config.ts`:
   ```ts
   "vendor-three": ["three", "@react-three/fiber", "@react-three/drei"]
   ```

3. **Create type bridge** — `core/types.ts`:
   ```ts
   export type OfficeAgentState = "working" | "standing" | "walking" | "away" | "error";
   export interface OfficeAgent {
     id: string;
     name: string;
     state: OfficeAgentState;
     color: string;
     deskIndex: number;
     hasActiveRun: boolean;
   }
   ```

4. **Create mapper** — `core/mapAgentState.ts`:
   - Maps AIDEVELO agent + liveRuns data → `OfficeAgent`
   - Uses liveRuns to detect actual running state

5. **Create constants & geometry** — extract from Claw3D `core/`

**Verify:** `pnpm build` — Three.js chunk is separate, main bundle unaffected.

---

## Phase 2: Claw3D Scene Extraction (parallel with Phase 3)

**Source**: Clone `https://github.com/iamlukethedev/Claw3D.git`

1. **RetroOfficeScene** ← adapted from `src/features/retro-office/RetroOffice3D.tsx`
   - Strip from 60+ props to ~10:
     ```ts
     interface RetroOfficeSceneProps {
       agents: OfficeAgent[];
       onAgentClick?: (agentId: string) => void;
       quality?: "low" | "medium" | "high";
       maxFps?: number;
     }
     ```
   - Remove all Next.js imports, Phaser references, upstream gateway code

2. **AgentModel** ← from `src/features/retro-office/objects/agents.tsx`
   - Keep: walking, sitting, standing, away animations
   - Add: `error` state with red pulsing glow
   - Map `OfficeAgent.state` → animation

3. **OfficeFurniture** ← from `src/features/retro-office/objects/primitives.tsx`
   - Keep: desks, chairs, walls (instanced geometry)
   - Adapt materials for dark/light theme

4. **CameraLighting** ← from `src/features/retro-office/systems/cameraLighting.tsx`
   - Keep: OrbitControls, DayNight cycle
   - Theme-aware: dark mode = night scene, light mode = day scene

**Verify:** Render `RetroOfficeScene` with mock data — agents animate, camera controls work.

---

## Phase 3: Data Hook (parallel with Phase 2)

**Create `hooks/useOfficeAgents.ts`:**
```ts
export function useOfficeAgents(companyId: string | null) {
  const { data: agents } = useQuery({...queryKeys.agents.list...});
  const { data: liveRuns } = useQuery({...queryKeys.liveRuns...});

  return useMemo(() => {
    // Filter terminated, map via mapAgentToOfficeState, assign desk indices
  }, [agents, liveRuns]);
}
```

**Key insight:** LiveUpdatesProvider already invalidates `agents.list` and `liveRuns` queries on WebSocket events `agent.status` and `heartbeat.run.status`. Zero additional WebSocket work needed — the 3D scene auto-updates via React Query re-renders.

**Verify:** Log `officeAgents`, change agent status via API, confirm update within ~1s.

---

## Phase 4: Dashboard Integration Components

1. **VirtualOfficeCard** — dashboard widget
   - Collapsed: clickable card with low-FPS (10fps) 3D mini-preview + agent count badge + "View Office" button
   - IntersectionObserver gating (same pattern as `LightRays.tsx:117-134`)
   - Click → sets `expanded=true` → opens `VirtualOfficeDialog`

2. **VirtualOfficeDialog** — fullscreen overlay
   - Uses existing Radix `<Dialog>` + `<DialogContent>` from `ui/src/components/ui/dialog.tsx`
   - `max-w-[95vw] h-[85vh] p-0` — near-fullscreen
   - Contains `<RetroOfficeScene quality="high" maxFps={30} />`
   - `onAgentClick` → navigate to `/agents/{agentId}` via `useNavigate()`

3. **VirtualOfficeFallback** — mobile 2D view
   - Simple grid of agent status cards (no Three.js loaded)
   - Uses `useSidebar().isMobile` to gate

4. **Barrel index.ts** — lazy export:
   ```ts
   export { VirtualOfficeCard } from "./components/VirtualOfficeCard";
   ```

**Verify:** Desktop: preview card → expand dialog → click agent → navigates. Mobile: 2D fallback renders.

---

## Phase 5: Wire into Dashboard

In `ui/src/pages/Dashboard.tsx`:

```tsx
// Top: lazy import
const VirtualOfficeCard = lazy(() =>
  import("@/features/virtual-office").then(m => ({ default: m.VirtualOfficeCard }))
);

// JSX: between ActiveAgentsPanel (line ~209) and metrics grid
<Suspense fallback={null}>
  <VirtualOfficeCard companyId={selectedCompanyId!} />
</Suspense>
```

`fallback={null}` = zero impact on initial dashboard paint. Three.js loads in background.

**Verify:** Full flow: load dashboard → 3D card appears → expand → real-time agent updates → click agent → detail page.

---

## Phase 6: Theme & Polish

- Dark mode → night scene + neon accents matching `--primary` OKLch token
- Light mode → day scene + natural lighting
- Role-based agent colors (CEO=gold, CTO=cyan, Engineer=green, etc.)
- Keyboard: Escape closes (Radix auto), arrows cycle agents, Enter selects
- Persist collapsed/hidden state in `localStorage` key `aidevelo:virtual-office-visible`

---

## Phase 7: Performance & Edge Cases

- **0 agents** → empty office + "No agents yet" overlay
- **50+ agents** → instanced rendering keeps FPS ≥ 30
- **WebGL cleanup** → follow `LightRays.tsx:323-338` pattern (`WEBGL_lose_context`, disposal)
- **Bundle** → `vendor-three` chunk isolated, verify with `vite build`
- **Low-end** → `quality="low"` disables shadows, caps DPR at 1x

---

## Verification Checklist

- [ ] `pnpm build` succeeds, `vendor-three` chunk is separate (~600KB)
- [ ] Dashboard loads without regression (Lighthouse unchanged)
- [ ] 3D preview card renders on desktop after lazy load
- [ ] Clicking "View Office" opens fullscreen dialog
- [ ] Agents animate correctly per status mapping
- [ ] Changing agent status via API → 3D scene updates in real-time
- [ ] Clicking agent in 3D → navigates to agent detail page
- [ ] Mobile shows 2D fallback, no Three.js loaded
- [ ] Theme toggle updates scene lighting
- [ ] Dialog close properly disposes WebGL context
- [ ] Collapsed/hidden preference persists across page reloads

---

## Reuse Existing Patterns

| Pattern | Source | Reuse In |
|---------|--------|----------|
| Lazy page loading | `App.tsx:31-53` | VirtualOfficeCard import |
| IntersectionObserver gating | `LightRays.tsx:117-134` | Preview canvas visibility |
| WebGL cleanup | `LightRays.tsx:323-338` | Scene disposal |
| Radix Dialog | `NewIssueDialog.tsx:22-24` | VirtualOfficeDialog |
| React Query agents | `Dashboard.tsx:43-81` | useOfficeAgents hook |
| Mobile detection | `SidebarContext` (`isMobile`) | 3D vs 2D fallback gate |
| Theme consumption | `ThemeContext` (`useTheme()`) | Scene lighting |
| Vendor chunk splitting | `vite.config.ts` manualChunks | vendor-three chunk |
