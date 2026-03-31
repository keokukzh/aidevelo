import type { ChatMessage, SendChatMessage } from "@aideveloai/shared";
import { api } from "./client";

export const chatApi = {
  messages: (companyId: string, agentId: string) =>
    api.get<ChatMessage[]>(`/companies/${companyId}/chat/${agentId}/messages`),

  send: (companyId: string, data: SendChatMessage) =>
    api.post<ChatMessage>(`/companies/${companyId}/chat/messages`, data),
};
