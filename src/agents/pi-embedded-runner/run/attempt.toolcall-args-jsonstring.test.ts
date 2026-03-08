import { describe, expect, it, vi } from "vitest";

// This test intentionally mirrors the stream-wrapper harness used in
// attempt.test.ts, but isolates the regression case for #39327:
// OpenAI-compatible providers sometimes return toolCall.arguments as a
// stringified JSON object.

describe("pi-embedded-runner tool call arguments", () => {
  it("parses stringified JSON toolCall.arguments into an object (regression #39327)", async () => {
    vi.resetModules();

    const mod = await import("./attempt.js");

    // attempt.ts exports wrapStreamFnTrimToolCallNames; we compose it with the
    // exported regression wrapper below.
    const wrapStreamFnTrimToolCallNames = (
      mod as unknown as {
        wrapStreamFnTrimToolCallNames: (
          baseFn: (model: unknown, context: unknown, options: unknown) => unknown,
          allowed?: Set<string>,
        ) => (model: unknown, context: unknown, options: unknown) => unknown;
      }
    ).wrapStreamFnTrimToolCallNames;

    const wrapStreamFnParseJsonStringToolCallArguments = (
      mod as unknown as {
        wrapStreamFnParseJsonStringToolCallArguments: (
          baseFn: (model: unknown, context: unknown, options: unknown) => unknown,
        ) => (model: unknown, context: unknown, options: unknown) => unknown;
      }
    ).wrapStreamFnParseJsonStringToolCallArguments;

    expect(typeof wrapStreamFnParseJsonStringToolCallArguments).toBe("function");

    const toolCall = {
      type: "toolCall",
      id: "call_1",
      name: "read",
      arguments: JSON.stringify({ path: "/tmp/a" }),
    };

    const finalMessage = { role: "assistant", content: [toolCall] };

    // Minimal fake stream compatible with the wrapper logic.
    const fakeStream = {
      async result() {
        return finalMessage;
      },
      async *[Symbol.asyncIterator]() {
        yield { type: "toolcall_delta", message: finalMessage };
      },
    };

    const baseFn = vi.fn(() => fakeStream);

    const wrapped = wrapStreamFnParseJsonStringToolCallArguments(
      wrapStreamFnTrimToolCallNames(baseFn, new Set(["read"])),
    );

    const stream = wrapped({} as unknown, {} as unknown, {} as unknown);

    // Drain
    for await (const _ of stream as AsyncIterable<unknown>) {
      // noop
    }

    await (stream as { result: () => Promise<unknown> }).result();

    expect(toolCall.arguments).toEqual({ path: "/tmp/a" });
  });
});
