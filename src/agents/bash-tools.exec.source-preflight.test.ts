import { describe, expect, it } from "vitest";
import { createExecTool } from "./bash-tools.exec.js";

describe("exec source guardrail", () => {
  it("refuses fenced code blocks", async () => {
    const tool = createExecTool({ host: "gateway", security: "full", ask: "off" });

    await expect(
      tool.execute("call-fenced", {
        command: "```python\nfrom x import y\nprint(y)\n```",
        workdir: process.cwd(),
      }),
    ).rejects.toThrow(/fenced code block/);
  });

  it("refuses obvious Python source pasted as command", async () => {
    const tool = createExecTool({ host: "gateway", security: "full", ask: "off" });

    await expect(
      tool.execute("call-python", {
        command: "from pathlib import Path\nprint('hi')\n",
        workdir: process.cwd(),
      }),
    ).rejects.toThrow(/looks like source code/);
  });

  it("does not block normal shell commands", async () => {
    const tool = createExecTool({ host: "gateway", security: "full", ask: "off" });

    const result = await tool.execute("call-echo", {
      command: "echo ok",
      workdir: process.cwd(),
    });

    const text = result.content.find((block) => block.type === "text")?.text ?? "";
    expect(text).toContain("ok");
  });
});
