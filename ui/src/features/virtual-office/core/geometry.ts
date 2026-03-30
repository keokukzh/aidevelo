// Desk grid layout: rows × columns
const GRID_COLS = 4;
const DESK_SPACING_X = 2.5;
const DESK_SPACING_Z = 2.5;
const GRID_ORIGIN_X = -(GRID_COLS * DESK_SPACING_X) / 2;

export function deskIndexToWorld(deskIndex: number): [number, number, number] {
  const row = Math.floor(deskIndex / GRID_COLS);
  const col = deskIndex % GRID_COLS;
  return [
    GRID_ORIGIN_X + col * DESK_SPACING_X,
    0,
    -2 + row * DESK_SPACING_Z,
  ];
}

export function walkingPathForAgent(agentId: string): [number, number, number][] {
  // Return a simple looping path for idle agents
  const seed = agentId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const cx = (seed % 6) - 3;
  return [
    [cx, 0, 1],
    [cx + 1, 0, 2],
    [cx, 0, 3],
    [cx - 1, 0, 2],
  ];
}
