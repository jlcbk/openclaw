import { describe, expect, it } from "vitest";
import { OpenAIRealtimeSTTProvider } from "./stt-openai-realtime.js";

// Regression: config values of 0 must not be swallowed by `||` defaults.
// See: openclaw/openclaw#39190

describe("OpenAIRealtimeSTTProvider config", () => {
  it("keeps silenceDurationMs=0 and vadThreshold=0", () => {
    const provider = new OpenAIRealtimeSTTProvider({
      apiKey: "test",
      model: "test-model",
      silenceDurationMs: 0,
      vadThreshold: 0,
    });

    // Reach into private fields for a minimal unit test.
    // (Alternative would be to refactor the provider to expose config.)
    expect((provider as any).silenceDurationMs).toBe(0);
    expect((provider as any).vadThreshold).toBe(0);
  });

  it("falls back to defaults when values are undefined", () => {
    const provider = new OpenAIRealtimeSTTProvider({ apiKey: "test" });
    expect((provider as any).silenceDurationMs).toBe(800);
    expect((provider as any).vadThreshold).toBe(0.5);
  });
});
