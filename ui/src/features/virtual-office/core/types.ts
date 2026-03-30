export type OfficeAgentState = "working" | "standing" | "walking" | "away" | "error";

export interface OfficeAgent {
  id: string;
  name: string;
  state: OfficeAgentState;
  color: string;       // hex color for the agent's avatar
  deskIndex: number;   // which desk position they occupy
  hasActiveRun: boolean;
  role: string;        // original AIDEVELO role
}
