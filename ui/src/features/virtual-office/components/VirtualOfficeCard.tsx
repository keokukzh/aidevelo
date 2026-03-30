import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useSidebar } from "@/context/SidebarContext";
import { useOfficeAgents } from "../hooks/useOfficeAgents";
import { FPS } from "../core/constants";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RetroOfficeScene } from "../scenes/RetroOfficeScene";

const GRID_COLS = 4;
const DESK_SPACING_X = 2.5;
const DESK_SPACING_Z = 2.5;
const GRID_ORIGIN_X = -(GRID_COLS * DESK_SPACING_X) / 2;

function deskIndexToMinimapPos(deskIndex: number): { x: number; y: number } {
  const row = Math.floor(deskIndex / GRID_COLS);
  const col = deskIndex % GRID_COLS;
  return {
    x: GRID_ORIGIN_X + col * DESK_SPACING_X,
    y: -2 + row * DESK_SPACING_Z,
  };
}

interface VirtualOfficeCardProps {
  companyId: string;
}

export function VirtualOfficeCard({ companyId }: VirtualOfficeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { theme } = useTheme();
  const { isMobile } = useSidebar();
  const { officeAgents } = useOfficeAgents({ companyId });
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  // Handle Escape key when dialog is open
  useEffect(() => {
    if (!expanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedAgentId(null);
        setExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  const handleToggle = () => setExpanded((v) => !v);
  const handleClose = useCallback(() => {
    setSelectedAgentId(null);
    setExpanded(false);
  }, []);

  const handleAgentClick = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    // Small delay before navigation to allow selection to show
    setTimeout(() => {
      navigate(`/agents/${agentId}`);
    }, 300);
  }, [navigate]);

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
              selectedAgentId={null}
            />
          </Suspense>
        )}
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={handleToggle}>
          View Office
        </Button>
      </div>

      <Dialog open={expanded} onOpenChange={handleClose}>
        <DialogContent className="max-w-[95vw] h-[85vh] p-0 overflow-hidden">
          <div className="relative w-full h-full">
            <RetroOfficeScene
              agents={officeAgents}
              theme={theme === "dark" ? "dark" : "light"}
              quality="high"
              maxFps={FPS.HIGH}
              selectedAgentId={selectedAgentId}
              onAgentClick={handleAgentClick}
            />
            <Minimap agents={officeAgents} />
            {selectedAgentId && <AgentStatusBar agentId={selectedAgentId} agents={officeAgents} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AgentStatusBar({ agentId, agents }: { agentId: string; agents: ReturnType<typeof useOfficeAgents>["officeAgents"] }) {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return null;

  const stateLabel = agent.state === "working" ? "Working" :
    agent.state === "standing" ? "Available" :
    agent.state === "away" ? "Away" :
    agent.state === "error" ? "Error" :
    agent.state === "walking" ? "Moving" : agent.state;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6">
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: agent.color }}
        >
          {agent.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium text-sm truncate">{agent.name}</div>
          <div className="text-white/60 text-xs capitalize">{agent.role}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            agent.state === "working" ? "bg-blue-500/30 text-blue-300" :
            agent.state === "error" ? "bg-red-500/30 text-red-300" :
            agent.state === "away" ? "bg-gray-500/30 text-gray-300" :
            "bg-green-500/30 text-green-300"
          }`}>
            {stateLabel}
          </span>
          {agent.hasActiveRun && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/30 text-emerald-300 animate-pulse">
              Active Run
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Minimap({ agents }: { agents: ReturnType<typeof useOfficeAgents>["officeAgents"] }) {
  const agentDeskMap = useMemo(() => {
    const map = new Map<number, typeof agents[0]>();
    agents.forEach((agent) => {
      map.set(agent.deskIndex, agent);
    });
    return map;
  }, [agents]);

  const viewBox = "-8 -5 16 14";

  return (
    <div className="absolute bottom-4 right-4 w-36 h-28 bg-black/60 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
      <svg viewBox={viewBox} className="w-full h-full">
        {Array.from({ length: 16 }, (_, i) => {
          const pos = deskIndexToMinimapPos(i);
          const occupyingAgent = agentDeskMap.get(i);
          return (
            <rect
              key={i}
              x={pos.x - 0.8}
              y={pos.y - 0.4}
              width={1.6}
              height={0.8}
              fill={occupyingAgent ? `${occupyingAgent.color}40` : "#374151"}
              stroke={occupyingAgent ? occupyingAgent.color : "#4B5563"}
              strokeWidth={0.1}
              rx={0.1}
            />
          );
        })}
        {agents.map((agent) => {
          const pos = deskIndexToMinimapPos(agent.deskIndex);
          return (
            <circle
              key={agent.id}
              cx={pos.x}
              cy={pos.y}
              r={0.25}
              fill={agent.color}
              stroke={agent.state === "error" ? "#EF4444" : agent.state === "working" ? "#10B981" : "#1F2937"}
              strokeWidth={0.1}
            />
          );
        })}
      </svg>
    </div>
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