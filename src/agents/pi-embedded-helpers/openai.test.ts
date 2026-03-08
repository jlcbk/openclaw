import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { downgradeOpenAIFunctionCallReasoningPairs } from "./openai.js";

describe("downgradeOpenAIFunctionCallReasoningPairs", () => {
  it("strips |fc_* suffix from tool call ids when no replayable reasoning item exists", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "hi" },
          { type: "toolCall", id: "call_1|fc_123", name: "read", args: {} },
        ],
      } as unknown as AgentMessage,
      {
        role: "toolResult",
        toolCallId: "call_1|fc_123",
        content: [{ type: "text", text: "ok" }],
      } as unknown as AgentMessage,
    ];

    const out = downgradeOpenAIFunctionCallReasoningPairs(messages);

    const assistant = out[0] as Extract<AgentMessage, { role: "assistant" }>;
    expect(Array.isArray(assistant.content)).toBe(true);
    const toolCall = (assistant.content as Array<{ type?: unknown; id?: unknown }>).find(
      (b) => (b as { type?: unknown }).type === "toolCall",
    );
    expect(toolCall?.id).toBe("call_1");

    const toolResult = out[1] as Extract<AgentMessage, { role: "toolResult" }>;
    expect((toolResult as { toolCallId?: unknown }).toolCallId).toBe("call_1");
  });

  it("keeps tool call ids intact when a replayable reasoning signature is present in the same assistant turn", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinkingSignature: JSON.stringify({ id: "rs_123", type: "reasoning" }),
          },
          { type: "toolCall", id: "call_1|fc_123", name: "read", args: {} },
        ],
      } as unknown as AgentMessage,
      {
        role: "toolResult",
        toolCallId: "call_1|fc_123",
        content: [{ type: "text", text: "ok" }],
      } as unknown as AgentMessage,
    ];

    const out = downgradeOpenAIFunctionCallReasoningPairs(messages);

    const assistant = out[0] as Extract<AgentMessage, { role: "assistant" }>;
    const toolCall = (assistant.content as Array<{ type?: unknown; id?: unknown }>).find(
      (b) => (b as { type?: unknown }).type === "toolCall",
    );
    expect(toolCall?.id).toBe("call_1|fc_123");

    const toolResult = out[1] as Extract<AgentMessage, { role: "toolResult" }>;
    expect((toolResult as { toolCallId?: unknown }).toolCallId).toBe("call_1|fc_123");
  });
});
