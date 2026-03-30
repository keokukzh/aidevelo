import { useMemo, useRef } from "react";
import type { OfficeAgent, OfficeAgentState } from "../core/types";
import { deskIndexToWorld, walkingPathForAgent } from "../core/geometry";

export type AgentAnimationState = "idle" | "walking" | "sitting" | "standing" | "patrol";

export interface AnimationEntry {
  agentId: string;
  state: AgentAnimationState;
  previousState: AgentAnimationState;
  progress: number;
  fromPosition: [number, number, number];
  toPosition: [number, number, number];
  isWalking: boolean;
  idlePathIndex: number;
  isPatrol: boolean;
}

export const ANIM = {
  WALK_DURATION: 0.8,
  SIT_DELAY: 0.4,
  BREATHE_CYCLE: 2.0,
  TYPING_CYCLE: 0.8,
  IDLE_BEFORE_PATROL_MS: 30_000,
  PATROL_SPEED: 0.001,
} as const;

function stateToAnimation(
  agentState: OfficeAgentState,
): AgentAnimationState {
  switch (agentState) {
    case "working":
      return "sitting";
    case "walking":
    case "standing":
      return "standing";
    case "away":
    case "error":
      return "idle";
    default:
      return "idle";
  }
}

function getTargetPosition(deskIndex: number): [number, number, number] {
  return deskIndexToWorld(deskIndex);
}

export function useOfficeAnimations(agents: OfficeAgent[]) {
  const prevStatesRef = useRef<Map<string, { 
    state: OfficeAgentState; 
    deskIndex: number; 
    worldPos: [number, number, number]; 
    animState: AgentAnimationState;
    idleStartTime?: number;
    isPatrolling: boolean;
  }>>(new Map());
  const idlePathProgressRef = useRef<Map<string, number>>(new Map());
  const patrolTimerRef = useRef<Map<string, number>>(new Map());

  const animationStates = useMemo(() => {
    const states = new Map<string, AnimationEntry>();
    const now = Date.now();

    for (const agent of agents) {
      const prev = prevStatesRef.current.get(agent.id);
      const prevState = prev?.state;
      const prevDeskIndex = prev?.deskIndex;
      const prevWorldPos = prev?.worldPos ?? getTargetPosition(agent.deskIndex);
      const prevIsPatrolling = prev?.isPatrolling ?? false;
      const currentAnimState = stateToAnimation(agent.state);
      const targetPos = getTargetPosition(agent.deskIndex);

      let idlePathIndex = idlePathProgressRef.current.get(agent.id) ?? 0;
      let isPatrol = prevIsPatrolling;

      if (currentAnimState === "idle" && !prevIsPatrolling) {
        if (patrolTimerRef.current.get(agent.id) === undefined) {
          patrolTimerRef.current.set(agent.id, now);
        }
        const idleTime = now - (patrolTimerRef.current.get(agent.id) ?? now);
        if (idleTime >= ANIM.IDLE_BEFORE_PATROL_MS) {
          isPatrol = true;
        }
      } else if (currentAnimState !== "idle") {
        patrolTimerRef.current.set(agent.id, 0);
        isPatrol = false;
      } else if (prev?.idleStartTime !== undefined && prevIsPatrolling) {
        // Agent was patrolling and came back to idle - reset the timer
        patrolTimerRef.current.set(agent.id, now);
      }

      if (prevState !== undefined && (prevState !== agent.state || prevDeskIndex !== agent.deskIndex)) {
        const fromPos = prevWorldPos;
        const prevAnim = prev?.animState ?? "idle";
        
        if (isPatrol && currentAnimState === "idle") {
          states.set(agent.id, {
            agentId: agent.id,
            state: "patrol",
            previousState: "patrol",
            progress: 1,
            fromPosition: prevWorldPos,
            toPosition: prevWorldPos,
            isWalking: true,
            idlePathIndex,
            isPatrol: true,
          });
        } else {
          states.set(agent.id, {
            agentId: agent.id,
            state: "walking",
            previousState: prevAnim,
            progress: 0,
            fromPosition: fromPos,
            toPosition: targetPos,
            isWalking: true,
            idlePathIndex,
            isPatrol: false,
          });
        }
      } else {
        const existing = states.get(agent.id);
        if (existing) {
          if (isPatrol && existing.state !== "patrol") {
            states.set(agent.id, {
              ...existing,
              state: "patrol",
              isWalking: true,
              isPatrol: true,
            });
          } else {
            states.set(agent.id, {
              ...existing,
              state: currentAnimState,
              isWalking: existing.progress < 1 || isPatrol,
              isPatrol,
            });
          }
        } else {
          states.set(agent.id, {
            agentId: agent.id,
            state: isPatrol ? "patrol" : currentAnimState,
            previousState: currentAnimState,
            progress: 1,
            fromPosition: targetPos,
            toPosition: targetPos,
            isWalking: false,
            idlePathIndex,
            isPatrol,
          });
        }
      }

      if (isPatrol) {
        const path = walkingPathForAgent(agent.id);
        const pathProgress = idlePathProgressRef.current.get(agent.id) ?? 0;
        const nextProgress = pathProgress + ANIM.PATROL_SPEED;
        idlePathProgressRef.current.set(agent.id, nextProgress % path.length);
        const pathIdx = Math.floor(nextProgress) % path.length;
        const pathPos = path[pathIdx];
        const state = states.get(agent.id);
        if (state) {
          state.fromPosition = pathPos;
          state.toPosition = pathPos;
          state.idlePathIndex = pathIdx;
        }
      }

      prevStatesRef.current.set(agent.id, { 
        state: agent.state, 
        deskIndex: agent.deskIndex,
        worldPos: targetPos,
        animState: isPatrol ? "patrol" : currentAnimState,
        idleStartTime: currentAnimState === "idle" ? (patrolTimerRef.current.get(agent.id) ?? now) : undefined,
        isPatrolling: isPatrol,
      });
    }

    return states;
  }, [agents]);

  return { animationStates };
}

export function getAnimationBob(
  state: AgentAnimationState,
  elapsed: number
): number {
  switch (state) {
    case "idle":
      return Math.sin(elapsed * (Math.PI * 2) / ANIM.BREATHE_CYCLE) * 0.01;
    case "sitting":
      return Math.sin(elapsed * (Math.PI * 2) / ANIM.TYPING_CYCLE) * 0.02;
    case "patrol":
      return Math.sin(elapsed * (Math.PI * 2) / ANIM.BREATHE_CYCLE) * 0.008;
    case "walking":
    case "standing":
      return 0;
    default:
      return 0;
  }
}
