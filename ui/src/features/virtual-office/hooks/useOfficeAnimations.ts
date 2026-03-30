import { useMemo, useRef } from "react";
import type { OfficeAgent, OfficeAgentState } from "../core/types";
import { deskIndexToWorld } from "../core/geometry";

export type AgentAnimationState = "idle" | "walking" | "sitting" | "standing";

interface AnimationEntry {
  agentId: string;
  state: AgentAnimationState;
  previousState: AgentAnimationState;
  progress: number;
  fromPosition: [number, number, number];
  toPosition: [number, number, number];
}

// Animation timing constants (in seconds)
export const ANIM = {
  WALK_DURATION: 0.8,
  SIT_DELAY: 0.4,
  BREATHE_CYCLE: 2.0,
  TYPING_CYCLE: 0.8,
} as const;

function stateToAnimation(
  agentState: OfficeAgentState,
  deskIndex: number
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
  // Ref to store previous states for transition detection
  const prevStatesRef = useRef<Map<string, OfficeAgentState>>(new Map());

  const animationStates = useMemo(() => {
    const states = new Map<string, AnimationEntry>();

    for (const agent of agents) {
      const prevState = prevStatesRef.current.get(agent.id);
      const currentAnimState = stateToAnimation(agent.state, agent.deskIndex);
      const targetPos = getTargetPosition(agent.deskIndex);

      // Detect state transitions
      if (prevState !== agent.state) {
        // State changed - trigger transition
        const fromPos = prevState
          ? getTargetPosition(agent.deskIndex)
          : targetPos;

        states.set(agent.id, {
          agentId: agent.id,
          state: currentAnimState,
          previousState: currentAnimState,
          progress: 0,
          fromPosition: fromPos,
          toPosition: targetPos,
        });

        prevStatesRef.current.set(agent.id, agent.state);
      } else {
        // No state change - continue current animation
        const existing = states.get(agent.id);
        if (existing) {
          // Update with current data but keep animating
          states.set(agent.id, {
            ...existing,
            state: currentAnimState,
          });
        } else {
          // New agent or no animation needed
          states.set(agent.id, {
            agentId: agent.id,
            state: currentAnimState,
            previousState: currentAnimState,
            progress: 1,
            fromPosition: targetPos,
            toPosition: targetPos,
          });
        }
      }
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