import { describe, expect, it } from "vitest";
import {
  getCachedBoardActor,
  invalidateCachedBoardActor,
  setCachedBoardActor,
} from "../services/user-auth-cache.js";

describe("user auth cache", () => {
  it("stores and invalidates board actor cache entries", () => {
    const userId = "user-1";
    setCachedBoardActor(userId, {
      companyIds: ["company-a"],
      isInstanceAdmin: false,
    });

    expect(getCachedBoardActor(userId)).toMatchObject({
      companyIds: ["company-a"],
      isInstanceAdmin: false,
    });

    invalidateCachedBoardActor(userId);
    expect(getCachedBoardActor(userId)).toBeNull();
  });
});

