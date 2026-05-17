/** Cliente: lista ferramentas custom do tenant (rotas com sessão / API key). */
export async function fetchHubFerramentasCustom(headers: HeadersInit, all = false): Promise<unknown[]> {
  const q = all ? "?all=true" : "";
  const res = await fetch(`/api/hub/ferramentas-custom${q}`, { headers });
  const data: unknown = await res.json();
  if (!res.ok) {
    const err =
      data && typeof data === "object" && "error" in data && typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : "Falha ao carregar ferramentas.";
    throw new Error(err);
  }
  return Array.isArray(data) ? data : [];
}
