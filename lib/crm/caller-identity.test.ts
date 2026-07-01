import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocka a validação do token no Supabase — o teste controla o que `/auth/v1/user` "responde".
// Assim provamos que a identidade vem da VALIDAÇÃO na fonte, não do `sub` cru do cookie.
vi.mock("@/lib/auth/crm-session", () => ({
  CRM_ACCESS_COOKIE: "obra10_crm_access",
  fetchAuthUserFromAccessToken: vi.fn(),
}));

import { resolveCallerAuthId } from "./crm-api-auth";
import { fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";

const COOKIE = "obra10_crm_access";
const mockFetch = vi.mocked(fetchAuthUserFromAccessToken);

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/crm/x", { headers });
}

describe("resolveCallerAuthId — valida o token na FONTE (Supabase), não confia no sub cru do cookie", () => {
  beforeEach(() => mockFetch.mockReset());

  it("token VÁLIDO (Supabase confirma) → retorna o id validado", async () => {
    mockFetch.mockResolvedValue({ id: "user-real" });
    const r = req({ cookie: `${COOKIE}=um.token.qualquer` });
    expect(await resolveCallerAuthId(r)).toBe("user-real");
    expect(mockFetch).toHaveBeenCalledWith("um.token.qualquer");
  });

  it("cookie FORJADO (Supabase rejeita → null) → NÃO autentica (o bypass está fechado)", async () => {
    mockFetch.mockResolvedValue(null);
    const r = req({ cookie: `${COOKIE}=forjado.sub-do-dono.sem-assinatura` });
    expect(await resolveCallerAuthId(r)).toBeNull();
  });

  it("parseia o cookie mesmo com outros cookies antes", async () => {
    mockFetch.mockResolvedValue({ id: "user-real" });
    const r = req({ cookie: `foo=1; ${COOKIE}=tok; bar=2` });
    expect(await resolveCallerAuthId(r)).toBe("user-real");
    expect(mockFetch).toHaveBeenCalledWith("tok");
  });

  it("sem cookie → null, e nem chega a consultar o Supabase", async () => {
    expect(await resolveCallerAuthId(req({}))).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("IGNORA o x-caller-auth-id (não é mais fallback — era um header forjável do cliente)", async () => {
    mockFetch.mockResolvedValue(null);
    const r = req({ "x-caller-auth-id": "user-FORJADO" });
    expect(await resolveCallerAuthId(r)).toBeNull();
  });

  it("cookie com percent-encoding inválido → null (não lança, não consulta)", async () => {
    const r = req({ cookie: `${COOKIE}=%E0%A4%A` });
    expect(await resolveCallerAuthId(r)).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
