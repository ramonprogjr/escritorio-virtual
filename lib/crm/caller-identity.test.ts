import { describe, expect, it } from "vitest";
import { resolveCallerAuthId } from "./crm-api-auth";

/** Monta um JWT fake (header.payload.sig) com o `sub` desejado. */
function fakeJwt(sub: string): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub })}.assinatura-irrelevante`;
}

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/crm/x", { headers });
}

const COOKIE = "obra10_crm_access";

describe("resolveCallerAuthId — identidade vem do cookie de sessão, não do header forjável", () => {
  it("usa o sub do cookie e IGNORA o x-caller-auth-id quando há cookie", () => {
    const r = req({
      cookie: `${COOKIE}=${fakeJwt("user-real")}`,
      "x-caller-auth-id": "user-FORJADO",
    });
    expect(resolveCallerAuthId(r)).toBe("user-real");
  });

  it("parseia o cookie mesmo com outros cookies antes", () => {
    const r = req({ cookie: `foo=1; ${COOKIE}=${fakeJwt("user-real")}; bar=2` });
    expect(resolveCallerAuthId(r)).toBe("user-real");
  });

  it("sem cookie, cai no header (chamador interno já gated por x-api-key no proxy)", () => {
    expect(resolveCallerAuthId(req({ "x-caller-auth-id": "interno-123" }))).toBe("interno-123");
  });

  it("sem cookie e sem header → null", () => {
    expect(resolveCallerAuthId(req({}))).toBeNull();
  });

  it("cookie com token malformado → não lança; cai no header se houver", () => {
    const r = req({ cookie: `${COOKIE}=%E0%A4%A; outra=x`, "x-caller-auth-id": "fallback-1" });
    expect(resolveCallerAuthId(r)).toBe("fallback-1");
  });

  it("cookie sem claim sub → trata como ausente", () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "");
    const semSub = `${b64({ alg: "HS256" })}.${b64({ foo: "bar" })}.x`;
    expect(resolveCallerAuthId(req({ cookie: `${COOKIE}=${semSub}` }))).toBeNull();
  });
});
