import { apiRequest } from "@/lib/api/client";
import type { AIAgentOption, AIChatResponse, ProposedTaskItem } from "@/types/domain";

export async function fetchAvailableAIAgents(): Promise<AIAgentOption[]> {
  return apiRequest<AIAgentOption[]>("/ai/agents");
}

export async function sendAIChat(payload: {
  message: string;
  image_file_id?: string | null;
  conversation_id?: string | null;
  locale?: "vi" | "en";
}): Promise<AIChatResponse> {
  return apiRequest<AIChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmAIProposal(
  proposalId: string,
  payload: {
    selected_indices?: number[];
    edited_items?: ProposedTaskItem[];
  } = {}
): Promise<{ proposal_id: string; status: string; created_task_ids: string[]; created_count: number }> {
  return apiRequest(`/ai/proposals/${proposalId}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function rejectAIProposal(proposalId: string): Promise<{ status: string }> {
  return apiRequest(`/ai/proposals/${proposalId}/reject`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
