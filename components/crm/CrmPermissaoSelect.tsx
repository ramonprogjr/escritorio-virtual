"use client";

import {
  CRM_NIVEL_LABEL,
  CRM_PERMISSAO_DESCRICAO,
  crmRolesAtribuiveisPor,
  type CrmNivel,
} from "@/lib/crm/crm-permissoes";

type Props = {
  actorRole: string;
  value: string;
  onChange: (value: CrmNivel) => void;
  id?: string;
  required?: boolean;
  className?: string;
  showDescription?: boolean;
};

export function CrmPermissaoSelect({
  actorRole,
  value,
  onChange,
  id = "crm-permissao",
  required = true,
  className = "w-full min-h-11 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3]",
  showDescription = true,
}: Props) {
  const opcoes = crmRolesAtribuiveisPor(actorRole);
  const selected = opcoes.includes(value as CrmNivel) ? value : opcoes[0];
  const desc =
    selected && selected !== "owner"
      ? CRM_PERMISSAO_DESCRICAO[selected as Exclude<CrmNivel, "owner">]
      : null;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
        Permissão {required ? "*" : ""}
      </label>
      <select
        id={id}
        required={required}
        value={selected}
        onChange={(e) => onChange(e.target.value as CrmNivel)}
        className={className}
      >
        {opcoes.map((r) => (
          <option key={r} value={r}>
            {CRM_NIVEL_LABEL[r]}
          </option>
        ))}
      </select>
      {showDescription && desc ? (
        <p className="text-[11px] leading-snug text-[#6e7681]">{desc}</p>
      ) : null}
    </div>
  );
}
