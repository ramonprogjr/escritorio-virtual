/** Cookie httpOnly lido pelo `proxy.ts` para sessão CRM (sem @supabase/ssr). */
export const CRM_ACCESS_COOKIE = "obra10_crm_access";

export async function fetchAuthUserFromAccessToken(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const endpoint = `${url.replace(/\/$/, "")}/auth/v1/user`;
  const headers = { Authorization: `Bearer ${accessToken}`, apikey: key };

  // Retry em falhas TRANSITÓRIAS (rede/TLS/5xx/429) — comuns no dev local (workaround TLS).
  // Antes, um hiccup de rede caía no catch -> null -> a rota respondia 401 "Sessão inválida"
  // mesmo com token válido (login falhava 1x e só funcionava no retry manual). Token de fato
  // inválido (401/403 do Supabase) retorna null na hora, sem repetir (fail-closed).
  let ultimoErro: unknown = null;
  const MAX = 3;
  for (let tentativa = 0; tentativa < MAX; tentativa++) {
    try {
      const res = await fetch(endpoint, { headers, cache: "no-store" });
      if (res.ok) return (await res.json()) as { id: string; email?: string | null };
      if (res.status === 401 || res.status === 403) return null; // token realmente inválido
      ultimoErro = new Error(`Supabase /auth/v1/user HTTP ${res.status}`); // transitório
    } catch (err) {
      ultimoErro = err; // rede / TLS transitório
    }
    if (tentativa < MAX - 1) {
      await new Promise((r) => setTimeout(r, 200 * (tentativa + 1)));
    }
  }
  console.error("[fetchAuthUserFromAccessToken] falhou após retries (rede/TLS/Supabase):", ultimoErro);
  return null;
}
