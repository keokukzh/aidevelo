import { useState, useRef } from "react";
import { Html } from "@react-three/drei";
import type { OfficeAgent } from "../core/types";

interface AgentTooltipProps {
  agent: OfficeAgent;
  position: [number, number, number];
  activeTask?: string;
}

export function AgentTooltip({ agent, position, activeTask }: AgentTooltipProps) {
  const [visible, setVisible] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerEnter = () => {
    hoverTimer.current = setTimeout(() => setVisible(true), 200);
  };

  const handlePointerLeave = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setVisible(false);
  };

  const stateLabel = agent.state === "working" && activeTask
    ? activeTask
    : agent.state === "working"
    ? "Working"
    : agent.state === "idle" || agent.state === "standing"
    ? "Available"
    : agent.state === "away"
    ? "Away"
    : agent.state === "error"
    ? "Error"
    : agent.state === "walking"
    ? "Moving"
    : "Unknown";

  return (
    <Html
      position={[position[0], position[1] + 1.5, position[2]]}
      center
      distanceFactor={8}
      zIndexRange={[100, 0]}
    >
      <div
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={`agent-tooltip ${visible ? "visible" : ""}`}
      >
        <style>{`
          .agent-tooltip {
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 8px;
            padding: 8px 12px;
            min-width: 120px;
            opacity: 0;
            transform: translateY(4px);
            transition: opacity 150ms ease, transform 150ms ease;
            pointer-events: auto;
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          .agent-tooltip.visible {
            opacity: 1;
            transform: translateY(0);
          }
          .agent-tooltip .name {
            color: #F8FAFC;
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 4px;
          }
          .agent-tooltip .role {
            color: #94A3B8;
            font-size: 11px;
            text-transform: capitalize;
            margin-bottom: 4px;
          }
          .agent-tooltip .state {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 500;
          }
          .agent-tooltip .state.working {
            background: rgba(59, 130, 246, 0.2);
            color: #60A5FA;
          }
          .agent-tooltip .state.idle {
            background: rgba(34, 197, 94, 0.2);
            color: #4ADE80;
          }
          .agent-tooltip .state.away {
            background: rgba(100, 116, 139, 0.2);
            color: #94A3B8;
          }
          .agent-tooltip .state.error {
            background: rgba(239, 68, 68, 0.2);
            color: #F87171;
          }
        `}</style>
        <div className="name">{agent.name}</div>
        <div className="role">{agent.role}</div>
        <span className={`state ${agent.state}`}>{stateLabel}</span>
      </div>
    </Html>
  );
}