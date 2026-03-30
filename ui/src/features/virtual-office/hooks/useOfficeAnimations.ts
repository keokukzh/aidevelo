import { useMemo, useRef } from "react";
import type { OfficeAgent, OfficeAgentState } from "../core/types";
import { deskIndexToWorld, walkingPathForAgent } from "../core/geometry";

export type AgentAnimationState = "idle" | "walking" | "sitting" | "standing";

export interface AnimationEntry {
  agentId: string;
  state: AgentAnimationState;
  previousState: AgentAnimationState;
  progress: number;
  fromPosition: [number, number, number];
  toPosition: [number, number, number];
  isWalking: boolean;
  idlePathIndex: number;
}

export const ANIM = {
  WALK_DURATION: 0.8,
  SIT_DELAY: 0.4,
  BREATHE_CYCLE: 2.0,
  TYPING_CYCLE: 0.8,
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
  const prevStatesRef = useRef<Map<string, { state: OfficeAgentState; deskIndex: number; worldPos: [number, number, number]; animState: AgentAnimationState }>>(new Map());
  const idlePathProgressRef = useRef<Map<string, number>>(new Map());

  const animationStates = useMemo(() => {
    const states = new Map<string, AnimationEntry>();

    for (const agent of agents) {
      const prev = prevStatesRef.current.get(agent.id);
      const prevState = prev?.state;
      const prevDeskIndex = prev?.deskIndex;
      const prevWorldPos = prev?.worldPos ?? getTargetPosition(agent.deskIndex);
      const currentAnimState = stateToAnimation(agent.state);
      const targetPos = getTargetPosition(agent.deskIndex);

      let isWalking = false;
      let idlePathIndex = idlePathProgressRef.current.get(agent.id) ?? 0;

      if (prevState !== undefined && (prevState !== agent.state || prevDeskIndex !== agent.deskIndex)) {
        const fromPos = prevWorldPos;
        const prevAnim = prev?.animState ?? "idle";
        isWalking = true;

        states.set(agent.id, {
          agentId: agent.id,
          state: "walking",
          previousState: prevAnim,
          progress: 0,
          fromPosition: fromPos,
          toPosition: targetPos,
          isWalking: true,
          idlePathIndex,
        });
      } else {
        const existing = states.get(agent.id);
        if (existing) {
          states.set(agent.id, {
            ...existing,
            state: currentAnimState,
            isWalking: existing.progress < 1,
          });
        } else {
          states.set(agent.id, {
            agentId: agent.id,
            state: currentAnimState,
            previousState: currentAnimState,
            progress: 1,
            fromPosition: targetPos,
            toPosition: targetPos,
            isWalking: false,
            idlePathIndex,
          });
        }
      }

      if (currentAnimState === "idle") {
        const path = walkingPathForAgent(agent.id);
        const pathProgress = idlePathProgressRef.current.get(agent.id) ?? 0;
        const nextIndex = pathProgress + 0.002;
        idlePathProgressRef.current.set(agent.id, nextIndex % path.length);
        const pathIdx = Math.floor(nextIndex) % path.length;
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
        animState: currentAnimState,
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
      // Subtle breathing
      return Math.sin(elapsed * (Math.PI * 2) / ANIM.BREATHE_CYCLE) * 0.01;
    case "sitting":
      // Typing bob
      return Math.sin(elapsed * (Math.PI * 2) / ANIM.TYPING_CYCLE) * 0.02;
    case "walking":
    case "standing":
      return 0;
    default:
      return 0;
  }
}