import { describe, expect, it } from "vitest";
import {
  buildJoinDefaultsPayloadForAccept,
  canReplayaideveloGatewayInviteAccept,
  mergeJoinDefaultsPayloadForReplay,
} from "../routes/access.js";

describe("canReplayaideveloGatewayInviteAccept", () => {
  it("allows replay only for aidevelo_gateway agent joins in pending or approved state", () => {
    expect(
      canReplayaideveloGatewayInviteAccept({
        requestType: "agent",
        adapterType: "aidevelo_gateway",
        existingJoinRequest: {
          requestType: "agent",
          adapterType: "aidevelo_gateway",
          status: "pending_approval",
        },
      }),
    ).toBe(true);

    expect(
      canReplayaideveloGatewayInviteAccept({
        requestType: "agent",
        adapterType: "aidevelo_gateway",
        existingJoinRequest: {
          requestType: "agent",
          adapterType: "aidevelo_gateway",
          status: "approved",
        },
      }),
    ).toBe(true);

    expect(
      canReplayaideveloGatewayInviteAccept({
        requestType: "agent",
        adapterType: "aidevelo_gateway",
        existingJoinRequest: {
          requestType: "agent",
          adapterType: "aidevelo_gateway",
          status: "rejected",
        },
      }),
    ).toBe(false);

    expect(
      canReplayaideveloGatewayInviteAccept({
        requestType: "human",
        adapterType: "aidevelo_gateway",
        existingJoinRequest: {
          requestType: "agent",
          adapterType: "aidevelo_gateway",
          status: "pending_approval",
        },
      }),
    ).toBe(false);
  });
});

describe("mergeJoinDefaultsPayloadForReplay", () => {
  it("merges replay payloads and allows gateway token override", () => {
    const merged = mergeJoinDefaultsPayloadForReplay(
      {
        url: "ws://old.example:18789",
        aideveloApiUrl: "http://host.docker.internal:3100",
        headers: {
          "x-aidevelo-token": "old-token-1234567890",
          "x-custom": "keep-me",
        },
      },
      {
        aideveloApiUrl: "https://aidevelo.example.com",
        headers: {
          "x-aidevelo-token": "new-token-1234567890",
        },
      },
    );

    const normalized = buildJoinDefaultsPayloadForAccept({
      adapterType: "aidevelo_gateway",
      defaultsPayload: merged,
      inboundaideveloAuthHeader: null,
    }) as Record<string, unknown>;

    expect(normalized.url).toBe("ws://old.example:18789");
    expect(normalized.aideveloApiUrl).toBe("https://aidevelo.example.com");
    expect(normalized.headers).toMatchObject({
      "x-aidevelo-token": "new-token-1234567890",
      "x-custom": "keep-me",
    });
  });
});
