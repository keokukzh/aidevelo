// Desk layout zones by role priority (lower = closer to premium)
export const ROLE_DESK_ZONE: Record<string, number> = {
  ceo: 0,
  cto: 1,
  cpo: 1,
  head_of: 1,
  engineer: 2,
  developer: 2,
  designer: 2,
  default: 3,
};

export const AGENT_COLORS: Record<string, string> = {
  ceo: "#F59E0B",    // amber/gold
  cto: "#06B6D4",    // cyan
  cpo: "#8B5CF6",    // violet
  head_of: "#EC4899", // pink
  engineer: "#10B981", // emerald
  developer: "#10B981",
  designer: "#F97316", // orange
  default: "#6B7280",  // gray
};

export const FPS = {
  PREVIEW: 10,
  HIGH: 30,
} as const;

export const QUALITY_DPR = {
  low: 1,
  medium: 1.5,
  high: 2,
} as const;
