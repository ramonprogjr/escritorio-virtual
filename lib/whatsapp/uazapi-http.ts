/** Chamadas HTTP à API UAZAPI (headers `admintoken` vs `token`). */

export function uazapiBaseUrlNormalizado(): string | null {
  const b = process.env.UAZAPI_BASE_URL?.trim();
  return b ? b.replace(/\/+$/, "") : null;
}

export type UazapiJsonResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; data: T | undefined; error: string };

export async function uazapiFetchJson<T = unknown>(
  path: string,
  options: {
    method?: string;
    /** Header `admintoken` — create/list/delete admin ops */
    admin?: boolean;
    /** Header `token` — operações da instância */
    instanceToken?: string;
    body?: unknown;
  }
): Promise<UazapiJsonResult<T>> {
  const base = uazapiBaseUrlNormalizado();
  if (!base) {
    return { ok: false, status: 0, data: undefined, error: "UAZAPI_BASE_URL não configurado" };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.admin) {
    const adm = process.env.UAZAPI_ADMIN_TOKEN?.trim();
    if (!adm) {
      return { ok: false, status: 0, data: undefined, error: "UAZAPI_ADMIN_TOKEN não configurado" };
    }
    headers.admintoken = adm;
  }

  if (options.instanceToken?.trim()) {
    headers.token = options.instanceToken.trim();
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const init: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, init);
    const ct = res.headers.get("content-type") || "";
    let data: unknown;
    try {
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        const t = await res.text();
        data = t ? t : undefined;
      }
    } catch {
      data = undefined;
    }

    if (!res.ok) {
      const msg =
        typeof data === "object" && data !== null && "error" in data && typeof (data as { error: string }).error === "string"
          ? (data as { error: string }).error
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, data: data as T, error: msg };
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: undefined,
      error: e instanceof Error ? e.message : "Erro de rede UAZAPI",
    };
  }
}
