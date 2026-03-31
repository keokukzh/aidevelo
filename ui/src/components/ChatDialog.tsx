import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Send, Maximize2, Minimize2, Bot, User } from "lucide-react";
import { chatApi } from "../api/chat";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { useCompany } from "../context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "../lib/utils";
import type { ChatMessage } from "@aideveloai/shared";

interface ChatDialogProps {
  agentId: string | null;
  onAgentChange: (agentId: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatDialog({ agentId, onAgentChange, open, onOpenChange }: ChatDialogProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch agents for selector
  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId && open),
  });

  // Auto-select first agent when agents load and no agent is selected
  useEffect(() => {
    if (agents.length > 0 && !agentId) {
      onAgentChange(agents[0].id);
    }
  }, [agents, agentId, onAgentChange]);

  // Fetch messages for selected agent
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: queryKeys.chat.messages(selectedCompanyId!, agentId ?? ""),
    queryFn: () => chatApi.messages(selectedCompanyId!, agentId ?? ""),
    enabled: Boolean(selectedCompanyId && open && agentId),
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      chatApi.send(selectedCompanyId!, { agentId: agentId ?? "", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messages(selectedCompanyId!, agentId ?? ""),
      });
      setInput("");
    },
  });

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMutation.mutate(input.trim());
  }, [input, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Close on Escape when fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [fullscreen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Don't render if not open or no company
  if (!open || !selectedCompanyId) return null;

  // Find selected agent name
  const selectedAgent = agents.find((a) => a.id === agentId);
  const selectedAgentName = selectedAgent?.name ?? "Agent";

  return (
    <div
      className={cn(
        "absolute inset-0 z-40 flex flex-col bg-background transition-all duration-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* Agent Selector */}
          <Select
            value={agentId ?? undefined}
            onValueChange={(value) => onAgentChange(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <span>{agent.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">
            Chat with {selectedAgentName}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bot className="h-12 w-12 opacity-20" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs">Start a conversation with {selectedAgentName}!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "flex max-w-[85%] items-start gap-2 rounded-lg px-3 py-2",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {msg.role === "agent" && (
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                  )}
                  {msg.role === "user" && (
                    <User className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                  )}
                  <div>
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t p-4 shrink-0">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">
            Chat with <span className="font-medium">{selectedAgentName}</span>
          </span>
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${selectedAgentName}...`}
              className="min-h-[60px] resize-none"
              rows={2}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
