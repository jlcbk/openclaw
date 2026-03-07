import { describe, expect, it } from "vitest";
import { authorizeHttpGatewayConnect, resolveGatewayAuth } from "./auth.js";
import { getBearerToken } from "./http-utils.js";

describe("getBearerToken", () => {
  it("trims trailing newline in Authorization header", async () => {
    const req = {
      socket: { remoteAddress: "127.0.0.1" },
      headers: { host: "127.0.0.1", authorization: "Bearer secret\n" },
    } as never;

    expect(getBearerToken(req)).toBe("secret");

    const auth = resolveGatewayAuth({
      authConfig: { mode: "token", token: "secret" },
      env: {} as NodeJS.ProcessEnv,
    });

    const token = getBearerToken(req);
    const res = await authorizeHttpGatewayConnect({
      auth,
      connectAuth: token ? { token, password: token } : null,
      req,
      trustedProxies: ["127.0.0.1"],
    });

    expect(res.ok).toBe(true);
  });
});
