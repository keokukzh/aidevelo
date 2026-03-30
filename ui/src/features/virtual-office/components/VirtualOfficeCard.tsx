import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useSidebar } from "@/context/SidebarContext";
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
          <RetroOfficeScene
            agents={officeAgents}
            theme={theme === "dark" ? "dark" : "light"}
            quality="high"
            maxFps={FPS.HIGH}
            selectedAgentId={selectedAgentId}
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