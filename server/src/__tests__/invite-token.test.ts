import { describe, expect, it } from "vitest";
import { createClaimSecret, createInviteToken, hashInviteToken } from "../services/invite-token.js";

describe("invite token service", () => {
  it("creates prefixed invite and claim tokens", () => {
    const inviteToken = createInviteToken();
    const claimSecret = createClaimSecret();

    expect(inviteToken.startsWith("pcp_invite_")).toBe(true);
    expect(claimSecret.startsWith("pcp_claim_")).toBe(true);
    expect(hashInviteToken(inviteToken)).toHaveLength(64);
  });
});

