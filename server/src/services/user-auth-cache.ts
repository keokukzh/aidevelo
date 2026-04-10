type CachedBoardActor = {
  companyIds: string[];
  isInstanceAdmin: boolean;
  expiresAt: number;
};

const BOARD_ACTOR_CACHE_TTL_MS = 30 * 1000;
const boardActorCache = new Map<string, CachedBoardActor>();

function boardActorKey(userId: string): string {
  return userId;
}

export function getCachedBoardActor(userId: string): CachedBoardActor | null {
  const entry = boardActorCache.get(boardActorKey(userId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    boardActorCache.delete(boardActorKey(userId));
    return null;
  }
  return entry;
}

export function setCachedBoardActor(userId: string, value: { companyIds: string[]; isInstanceAdmin: boolean }) {
  if (boardActorCache.size > 10_000) {
    const oldest = boardActorCache.keys().next().value;
    if (oldest) boardActorCache.delete(oldest);
  }
  boardActorCache.set(boardActorKey(userId), {
    companyIds: value.companyIds,
    isInstanceAdmin: value.isInstanceAdmin,
    expiresAt: Date.now() + BOARD_ACTOR_CACHE_TTL_MS,
  });
}

export function invalidateCachedBoardActor(userId: string) {
  boardActorCache.delete(boardActorKey(userId));
}

export function invalidateCachedBoardActors(userIds: string[]) {
  for (const userId of userIds) invalidateCachedBoardActor(userId);
}
