import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock clack prompts so we can simulate a cancelled text prompt.
vi.mock("@clack/prompts", () => {
  const cancelSymbol = Symbol.for("clack:cancel");
  return {
    confirm: vi.fn(async () => true),
    select: vi.fn(async () => "anthropic"),
    text: vi.fn(async () => cancelSymbol),
    isCancel: vi.fn((v: unknown) => v === cancelSymbol),
  };
});

// Avoid plugin/provider discovery overhead and side effects.
vi.mock("../../plugins/providers.js", () => ({
  resolvePluginProviders: vi.fn(async () => []),
}));

// Make config load/update no-ops so we only test auth-profiles side effects.
vi.mock("./shared.js", () => ({
  loadValidConfigOrThrow: vi.fn(async () => ({})),
  updateConfig: vi.fn(async (updater: (cfg: unknown) => unknown) => updater({})),
}));

// Ensure token validation doesn't throw on the cancel symbol path (we return before validation).
vi.mock("../auth-token.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth-token.js")>();
  return {
    ...actual,
    validateAnthropicSetupToken: vi.fn(() => undefined),
  };
});

import type { RuntimeEnv } from "../../runtime.js";
import { modelsAuthPasteTokenCommand, modelsAuthSetupTokenCommand } from "./auth.js";

const runtime: RuntimeEnv = {
  log: () => {},
  error: () => {},
  exit: () => {
    throw new Error("unexpected exit");
  },
};

describe("models auth token prompts", () => {
  let stateDir = "";
  let agentDir = "";

  afterEach(async () => {
    if (stateDir) {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
    delete process.env.OPENCLAW_STATE_DIR;
    delete process.env.OPENCLAW_AGENT_DIR;
  });

  it("does not persist clack cancel symbol for setup-token", async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-auth-cancel-"));
    agentDir = path.join(stateDir, "agents", "main", "agent");
    await fs.mkdir(agentDir, { recursive: true });
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.OPENCLAW_AGENT_DIR = agentDir;

    // Pretend TTY to bypass the command guard.
    const origIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

    await modelsAuthSetupTokenCommand({ provider: "anthropic", yes: true }, runtime);

    Object.defineProperty(process.stdin, "isTTY", { value: origIsTTY, configurable: true });

    await expect(fs.readFile(path.join(agentDir, "auth-profiles.json"), "utf8")).rejects.toThrow();
  });

  it("does not persist clack cancel symbol for paste-token", async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-auth-cancel-"));
    agentDir = path.join(stateDir, "agents", "main", "agent");
    await fs.mkdir(agentDir, { recursive: true });
    process.env.OPENCLAW_STATE_DIR = stateDir;
    process.env.OPENCLAW_AGENT_DIR = agentDir;

    await modelsAuthPasteTokenCommand(
      { provider: "anthropic", profileId: "anthropic:manual" },
      runtime,
    );

    await expect(fs.readFile(path.join(agentDir, "auth-profiles.json"), "utf8")).rejects.toThrow();
  });
});
