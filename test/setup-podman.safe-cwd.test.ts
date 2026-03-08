import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// This is a shell script, but we can still regress on its most important safety invariant:
// run_as_user must force a safe cwd so sudo/runuser doesn't fail with "cannot chdir" when the
// caller runs setup-podman.sh from a private/unreadable directory.

describe("setup-podman.sh", () => {
  it("forces a safe cwd inside run_as_user to avoid sudo -u cannot chdir", () => {
    const scriptPath = resolve(process.cwd(), "setup-podman.sh");
    const text = readFileSync(scriptPath, "utf8");

    // Assert the comment explaining the failure mode exists (keeps intent from regressing).
    expect(text).toMatch(/cannot chdir/i);

    // Assert run_as_user wraps sudo/runuser invocation in a subshell that cds into a safe path.
    // We keep this flexible but still meaningful: we want a leading ( cd "$safe_cwd" ...; sudo -u ... ).
    expect(text).toMatch(/\(\s*cd\s+"\$safe_cwd"[\s\S]*?sudo\s+-u\s+"\$user"/);

    // Also accept the root+runuser fallback path.
    expect(text).toMatch(/\(\s*cd\s+"\$safe_cwd"[\s\S]*?runuser\s+-u\s+"\$user"/);
  });
});
