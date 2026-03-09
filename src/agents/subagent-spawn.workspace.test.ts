import os from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSubagentRegistryForTests } from "./subagent-registry.js";
import { spawnSubagentDirect } from "./subagent-spawn.js";

const callGatewayMock = vi.fn();

vi.mock("../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

let configOverride: Record<string, unknown> = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
  agents: {
    defaults: {
      workspace: os.tmpdir(),
    },
    list: [
      { id: "main", workspace: "/tmp/requester" },
      { id: "ct-manager", workspace: "/tmp/target" },
    ],
  },
};

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
  };
});

vi.mock("./subagent-registry.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./subagent-registry.js")>();
  return {
    ...actual,
    countActiveRunsForSession: () => 0,
    registerSubagentRun: () => {},
  };
});

vi.mock("./subagent-announce.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./subagent-announce.js")>();
  return {
    ...actual,
    buildSubagentSystemPrompt: () => "system-prompt",
  };
});

vi.mock("./subagent-depth.js", () => ({
  getSubagentDepthFromSessionStore: () => 0,
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: () => ({ hasHooks: () => false }),
}));

function setupGatewayMock() {
  callGatewayMock.mockImplementation(
    async (opts: { method?: string; params?: Record<string, unknown> }) => {
      if (opts.method === "sessions.patch") {
        return { ok: true };
      }
      if (opts.method === "sessions.delete") {
        return { ok: true };
      }
      if (opts.method === "agent") {
        return { runId: "run-1" };
      }
      return {};
    },
  );
}

describe("spawnSubagentDirect workspace inheritance", () => {
  const ctx = {
    agentSessionKey: "agent:main:main",
    agentChannel: "telegram" as const,
    agentAccountId: "123",
    agentTo: "456",
  };

  beforeEach(() => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockClear();
    setupGatewayMock();
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          workspace: os.tmpdir(),
        },
        list: [
          { id: "main", workspace: "/tmp/requester", subagents: { allowAgents: ["ct-manager"] } },
          { id: "ct-manager", workspace: "/tmp/target" },
        ],
      },
    };
  });

  it("prefers the target agent workspace for spawned runs", async () => {
    const result = await spawnSubagentDirect(
      {
        task: "test",
        agentId: "ct-manager",
      },
      ctx,
    );

    expect(result.status).toBe("accepted");
    const agentCall = callGatewayMock.mock.calls.find(
      ([opts]) => opts?.method === "agent",
    )?.[0] as {
      params?: { workspaceDir?: string };
    };
    expect(agentCall?.params?.workspaceDir).toBe("/tmp/target");
  });

  it("falls back to requester workspace when the target agent has no explicit workspace", async () => {
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          workspace: os.tmpdir(),
        },
        list: [
          { id: "main", workspace: "/tmp/requester", subagents: { allowAgents: ["ct-manager"] } },
          { id: "ct-manager" },
        ],
      },
    };

    const result = await spawnSubagentDirect(
      {
        task: "test",
        agentId: "ct-manager",
      },
      ctx,
    );

    expect(result.status).toBe("accepted");
    const agentCall = callGatewayMock.mock.calls.find(
      ([opts]) => opts?.method === "agent",
    )?.[0] as {
      params?: { workspaceDir?: string };
    };
    expect(agentCall?.params?.workspaceDir).toBe("/tmp/requester");
  });
});
