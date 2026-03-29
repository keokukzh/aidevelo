import type { Request } from "express";

// Unified Actor type with all possible fields as optional.
// Runtime code uses type narrowing (req.actor.type === "board") to access specific fields.
export interface Actor {
  type: "board" | "agent" | "none";
  userId?: string | null;
  agentId?: string | null;
  companyId?: string | null;
  companyIds?: string[];
  keyId?: string | null;
  isInstanceAdmin?: boolean;
  runId?: string | null;
  source?: string;
}

declare global {
  namespace Express {
    interface Request {
      actor: Actor;
    }
  }
}
