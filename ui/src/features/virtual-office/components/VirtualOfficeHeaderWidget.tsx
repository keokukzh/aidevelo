import { lazy, Suspense, useState, useCallback, useMemo } from "react";
import { useCompany } from "@/context/CompanyContext";
import { useTheme } from "@/context/ThemeContext";
import { useSidebar } from "@/context/SidebarContext";
import { useOfficeAgents } from "../hooks/useOfficeAgents";
import { FPS } from "../core/constants";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, Maximize2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export function VirtualOfficeHeaderWidget() {
  const { selectedCompanyId } = useCompany();
  const { isMobile } = useSidebar();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { officeAgents } = useOfficeAgents({ companyId: selectedCompanyId ?? null });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const handleExpand = useCallback(() => {
    setPopoverOpen(false);
    setFullscreen(true);
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setSelectedAgentId(null);
    setFullscreen(false);
  }, []);

  const handleAgentClick = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setTimeout(() => {
      navigate(`/agents/${agentId}`);
      setFullscreen(false);
    }, 300);
  }, [navigate]);

  const workingCount = useMemo(
    () => officeAgents.filter((a) => a.state === "working").length,
    [officeAgents],
  );

  if (!selectedCompanyId || isMobile || officeAgents.length === 0) return null;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label="Virtual Office"
            title="Virtual Office"
          >
            <Building2 className="h-4 w-4" />
            {officeAgents.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {officeAgents.length}
              </span>
            )}
            {workingCount > 0 && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[420px] p-0 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider">Virtual Office</span>
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {officeAgents.length} agent{officeAgents.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleExpand}
                aria-label="Expand to full view"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setPopoverOpen(false)}
                aria-label="Close"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* 3D Scene Preview */}
          <div className="h-[200px] bg-black/20">
            <Suspense fallback={<div className="h-full bg-muted/50 animate-pulse" />}>
              <RetroOfficeScene
                agents={officeAgents.slice(0, 4)}
                theme={theme === "dark" ? "dark" : "light"}
                quality="low"
                maxFps={FPS.PREVIEW}
                selectedAgentId={null}
              />
            </Suspense>
          </div>

          {/* Agent List */}
          <div className="px-3 py-2 space-y-1 max-h-[180px] overflow-y-auto">
            {officeAgents.map((agent) => (
              <button
                key={agent.id}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-left"
                onClick={() => {
                  setPopoverOpen(false);
                  navigate(`/agents/${agent.id}`);
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="text-xs font-medium truncate flex-1">{agent.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                  agent.state === "working" ? "bg-blue-500/15 text-blue-400" :
                  agent.state === "error" ? "bg-red-500/15 text-red-400" :
                  agent.state === "away" ? "bg-gray-500/15 text-gray-400" :
                  "bg-green-500/15 text-green-400"
                }`}>
                  {agent.state}
                </span>
                {agent.hasActiveRun && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={handleExpand}
            >
              <Maximize2 className="h-3 w-3 mr-1.5" />
              Open Full View
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Full-screen dialog */}
      <Dialog open={fullscreen} onOpenChange={handleCloseFullscreen}>
        <DialogContent className="max-w-[95vw] h-[85vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Virtual Office</DialogTitle>
          <DialogDescription className="sr-only">
            Interactive 3D virtual office showing agent workspaces and real-time status
          </DialogDescription>
          <div className="relative w-full h-full">
            <RetroOfficeScene
              agents={officeAgents}
              theme={theme === "dark" ? "dark" : "light"}
              quality="high"
              maxFps={FPS.HIGH}
              selectedAgentId={selectedAgentId}
              onAgentClick={handleAgentClick}
            />
            <HeaderMinimap agents={officeAgents} />
            {selectedAgentId && <HeaderAgentStatusBar agentId={selectedAgentId} agents={officeAgents} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HeaderAgentStatusBar({ agentId, agents }: { agentId: string; agents: { id: string; name: string; state: string; color: string; role: string; hasActiveRun: boolean }[] }) {
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

function HeaderMinimap({ agents }: { agents: { id: string; color: string; state: string; deskIndex: number }[] }) {
  const agentDeskMap = useMemo(() => {
    const map = new Map<number, (typeof agents)[0]>();
    agents.forEach((agent) => map.set(agent.deskIndex, agent));
    return map;
  }, [agents]);

  return (
    <div className="absolute bottom-4 right-4 w-36 h-28 bg-black/60 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
      <svg viewBox="-8 -5 16 14" className="w-full h-full">
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
