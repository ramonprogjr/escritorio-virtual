import type { QueryClient } from "@tanstack/react-query";
import type { HubCargoCatalogRow } from "@/lib/hub/fetch-hub-cargos-catalog";

export const hubQueryKeys = {
  all: ["hub"] as const,
  cargosCatalog: () => [...hubQueryKeys.all, "cargos-catalog"] as const,
  ferramentasCustom: () => [...hubQueryKeys.all, "ferramentas-custom"] as const,
};

export function invalidateCargosCatalog(client: QueryClient) {
  return client.invalidateQueries({ queryKey: hubQueryKeys.cargosCatalog() });
}

/** Actualiza uma linha no cache do catálogo (ex.: PATCH `ativo`). */
export function patchCargosCache(client: QueryClient, slug: string, patch: Partial<HubCargoCatalogRow>) {
  const norm = slug.trim();
  client.setQueryData<HubCargoCatalogRow[]>(hubQueryKeys.cargosCatalog(), prev => {
    if (!prev) return prev;
    return prev.map(row =>
      String(row.slug ?? "").trim() === norm ? ({ ...row, ...patch } as HubCargoCatalogRow) : row
    );
  });
}

/** Actualiza várias linhas no cache (ex.: activar/desactivar em lote). */
export function patchCargosManyCache(client: QueryClient, updates: { slug: string; ativo: boolean }[]) {
  const map = new Map(updates.map(u => [u.slug.trim(), u.ativo]));
  client.setQueryData<HubCargoCatalogRow[]>(hubQueryKeys.cargosCatalog(), prev => {
    if (!prev) return prev;
    return prev.map(row => {
      const s = String(row.slug ?? "").trim();
      const ativo = map.get(s);
      return ativo !== undefined ? ({ ...row, ativo } as HubCargoCatalogRow) : row;
    });
  });
}
