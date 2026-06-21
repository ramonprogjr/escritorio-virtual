"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";

type Props = {
  variant?: "hero" | "page";
};

function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function HubLeadForm({ variant = "hero" }: Props) {
  const [empresa, setEmpresa] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inputClass =
    "w-full rounded-xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] px-4 py-3 text-[15px] text-[var(--obra-texto,#e6edf3)] placeholder:text-[var(--obra-texto-3,#484f58)] focus:border-[var(--obra-dourado,#c9a24a)] focus:outline-none focus:ring-1 focus:ring-[var(--obra-dourado,#c9a24a)]/35";
  const labelClass = "text-xs font-medium uppercase tracking-wide text-[var(--obra-texto-2,#8b949e)]";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/public/lead-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa, nome, email, telefone }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; codigo?: string };
      if (!res.ok) {
        setMsg(json.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      setSuccess(true);
    } catch {
      setMsg("Erro de ligação. Verifique a internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const cardClass =
    variant === "hero"
      ? "hub-reveal rounded-2xl border border-[var(--obra-borda,#30363d)]/80 bg-[var(--obra-dark-2,#161b22)]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-8"
      : "rounded-2xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] p-6 sm:p-8";

  if (success) {
    return (
      <div className={cardClass} id="cadastre">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-12 w-12 text-[#3fb950]" aria-hidden />
          <h2 className="mt-4 text-xl font-bold text-[var(--obra-texto,#e6edf3)]">Pedido recebido</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--obra-texto-2,#8b949e)]">
            Registámos o seu interesse. A nossa equipa entrará em contacto em breve no e-mail{" "}
            <strong className="text-[var(--obra-texto,#e6edf3)]">{email}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass} id="cadastre">
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "rgba(0, 92, 61, 0.25)" }}
        >
          <Building2 className="h-5 w-5 text-[var(--obra-dourado,#c9a24a)]" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--obra-texto,#e6edf3)]">Cadastre-se no Hub</h2>
          <p className="text-xs text-[var(--obra-texto-2,#8b949e)]">
            Empresa, contacto e telefone — entramos no funil comercial.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label htmlFor="hub_empresa" className={labelClass}>
            Empresa
          </label>
          <input
            id="hub_empresa"
            required
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className={inputClass}
            placeholder="Razão social ou nome fantasia"
            autoComplete="organization"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="hub_nome" className={labelClass}>
            Nome
          </label>
          <input
            id="hub_nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={inputClass}
            placeholder="Seu nome completo"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="hub_email" className={labelClass}>
            E-mail
          </label>
          <input
            id="hub_email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="voce@empresa.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="hub_telefone" className={labelClass}>
            Telefone
          </label>
          <input
            id="hub_telefone"
            type="tel"
            required
            value={telefone}
            onChange={(e) => setTelefone(maskTelefone(e.target.value))}
            className={inputClass}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
          />
        </div>

        {msg ? (
          <p
            role="alert"
            className="rounded-xl border border-[rgba(248,81,73,0.35)] bg-[rgba(179,38,30,0.08)] px-4 py-3 text-sm text-[#f0aba8]"
          >
            {msg}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)] disabled:opacity-50"
          style={{
            background:
              "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
          }}
        >
          {loading ? "A enviar…" : "Quero conhecer o Hub"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>

        <p className="text-center text-[10px] text-[var(--obra-texto-3,#484f58)]">
          Ao enviar, autoriza contacto comercial sobre o Obra10+ Hub.
        </p>
      </form>
    </div>
  );
}
