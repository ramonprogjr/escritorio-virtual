"use client";

import { usePathname } from "next/navigation";
import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { useCrmTenant } from "@/components/crm/CrmTenantContext";
import { defaultCrmHeaderForPath } from "@/lib/crm-header-defaults";
import { shouldHideCrmUniversalHeader } from "@/lib/crm-universal-header-visibility";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { CrmRastreioBusca } from "@/components/crm/CrmRastreioBusca";
import { NotificacoesSino } from "@/components/crm/NotificacoesSino";

export function CrmUniversalHeader() {
  const pathname = usePathname() || "";
  const { slot } = useCrmHeaderSlot();
  const { tenantNome, loading: tenantLoading } = useCrmTenant();
  const base = defaultCrmHeaderForPath(pathname);
  const scoped = slot != null && slot.path === pathname ? slot : null;

  if (shouldHideCrmUniversalHeader(pathname)) {
    return null;
  }

  const title = scoped?.title ?? base.title;
  const subtitle = scoped?.subtitle ?? base.subtitle;

  const tenantBadge =
    !tenantLoading && tenantNome ? (
      <span className="inline-flex max-w-[10rem] truncate rounded-full border border-[#c9a24a35] bg-[#c9a24a12] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#c9a24a]">
        {tenantNome}
      </span>
    ) : null;

  const actions = (
    <>
      {tenantBadge}
      <CrmRastreioBusca />
      <NotificacoesSino />
      {scoped?.actions ?? null}
    </>
  );

  return (
    <CrmPageHeader
      title={title}
      subtitle={subtitle}
      actions={actions}
      blendDesktopUnderlap
      className="flex-shrink-0"
    />
  );
}
