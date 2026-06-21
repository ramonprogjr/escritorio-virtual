"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, User } from "lucide-react";
import { Obra10BrandHeader } from "@/components/brand/Obra10Brand";
import { SIGNUP_SEGMENTOS, type SignupSegmento } from "@/lib/hub/landing-content";

const UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

type FormState = {
  razao_social: string;
  cnpj: string;
  cidade: string;
  estado: string;
  segmento: SignupSegmento | "";
  owner_name: string;
  owner_email: string;
  owner_password: string;
  owner_password_confirm: string;
  aceite_termos: boolean;
};

const initial: FormState = {
  razao_social: "",
  cnpj: "",
  cidade: "",
  estado: "",
  segmento: "",
  owner_name: "",
  owner_email: "",
  owner_password: "",
  owner_password_confirm: "",
  aceite_termos: false,
};

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function CadastreSeForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initial);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function validarCnpjRemoto(cnpj: string): Promise<boolean> {
    const res = await fetch(`/api/validar/cnpj?cnpj=${encodeURIComponent(cnpj)}`);
    const json = (await res.json()) as { valido?: boolean; razao_social?: string; municipio?: string; uf?: string };
    if (!json.valido) return false;
    if (json.razao_social && !form.razao_social.trim()) {
      update("razao_social", json.razao_social);
    }
    if (json.municipio && !form.cidade.trim()) update("cidade", json.municipio);
    if (json.uf && !form.estado.trim()) update("estado", json.uf);
    return true;
  }

  async function onStep1(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!form.razao_social.trim()) {
      setMsg("Informe a razão social da empresa.");
      return;
    }
    if (!form.segmento) {
      setMsg("Selecione o segmento da empresa.");
      return;
    }
    setLoading(true);
    try {
      const ok = await validarCnpjRemoto(form.cnpj);
      if (!ok) {
        setMsg("CNPJ inválido. Verifique os dígitos.");
        return;
      }
      setStep(2);
    } catch {
      setMsg("Não foi possível validar o CNPJ. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (form.owner_password !== form.owner_password_confirm) {
      setMsg("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/cadastro-empresa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razao_social: form.razao_social,
          cnpj: form.cnpj,
          cidade: form.cidade || null,
          estado: form.estado || null,
          segmento: form.segmento,
          owner_name: form.owner_name,
          owner_email: form.owner_email,
          owner_password: form.owner_password,
          aceite_termos: form.aceite_termos,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setMsg(json.error || "Erro ao cadastrar. Tente novamente.");
        return;
      }
      setSuccess(true);
    } catch {
      setMsg("Erro de rede. Verifique a ligação e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] px-4 py-3 text-[15px] text-[var(--obra-texto,#e6edf3)] placeholder:text-[var(--obra-texto-3,#484f58)] focus:border-[var(--obra-dourado,#c9a24a)] focus:outline-none focus:ring-1 focus:ring-[var(--obra-dourado,#c9a24a)]/35";
  const labelClass = "text-xs font-medium uppercase tracking-wide text-[var(--obra-texto-2,#8b949e)]";

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-xs text-[var(--obra-texto-2,#8b949e)] hover:text-[var(--obra-dourado,#c9a24a)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao Hub
      </Link>

      <Obra10BrandHeader size="md" subtitle="Cadastro de empresa" />

      {success ? (
        <div className="mt-10 rounded-2xl border border-[rgba(63,185,80,0.35)] bg-[rgba(35,134,54,0.12)] p-6">
          <h1 className="text-xl font-bold text-[#3fb950]">Cadastro recebido</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--obra-texto-2,#8b949e)]">
            Enviamos um e-mail de confirmação para{" "}
            <strong className="text-[var(--obra-texto,#e6edf3)]">{form.owner_email}</strong>. Confirme o endereço
            para activar a sua empresa na plataforma.
          </p>
          <Link
            href="/login?confirmed=1&next=/crm/onboarding-tenant"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[var(--obra-verde,#003b26)] px-5 text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)]"
          >
            Ir para login
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 flex gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-semibold ${
                  step === s
                    ? "border-[var(--obra-dourado,#c9a24a)]/50 bg-[var(--obra-dark-2,#161b22)] text-[var(--obra-dourado-light,#e0b86a)]"
                    : step > s
                      ? "border-[rgba(63,185,80,0.35)] text-[#3fb950]"
                      : "border-[var(--obra-borda,#30363d)] text-[var(--obra-texto-3,#484f58)]"
                }`}
              >
                {s === 1 ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                {s === 1 ? "Empresa" : "Responsável"}
              </div>
            ))}
          </div>

          {step === 1 ? (
            <form onSubmit={onStep1} className="mt-8 flex flex-col gap-5">
              <div className="space-y-1.5">
                <label htmlFor="razao_social" className={labelClass}>
                  Razão social
                </label>
                <input
                  id="razao_social"
                  required
                  value={form.razao_social}
                  onChange={(e) => update("razao_social", e.target.value)}
                  className={inputClass}
                  placeholder="Nome legal da empresa"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cnpj" className={labelClass}>
                  CNPJ
                </label>
                <input
                  id="cnpj"
                  required
                  value={form.cnpj}
                  onChange={(e) => update("cnpj", maskCnpj(e.target.value))}
                  className={inputClass}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="cidade" className={labelClass}>
                    Cidade
                  </label>
                  <input
                    id="cidade"
                    value={form.cidade}
                    onChange={(e) => update("cidade", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="estado" className={labelClass}>
                    UF
                  </label>
                  <select
                    id="estado"
                    value={form.estado}
                    onChange={(e) => update("estado", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {UF.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="segmento" className={labelClass}>
                  Segmento
                </label>
                <select
                  id="segmento"
                  required
                  value={form.segmento}
                  onChange={(e) => update("segmento", e.target.value as SignupSegmento)}
                  className={inputClass}
                >
                  <option value="">Selecione…</option>
                  {SIGNUP_SEGMENTOS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {msg && (
                <p
                  role="alert"
                  className="rounded-xl border border-[rgba(248,81,73,0.35)] bg-[rgba(179,38,30,0.08)] px-4 py-3 text-sm text-[#f0aba8]"
                >
                  {msg}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)] disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
                }}
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
              <div className="space-y-1.5">
                <label htmlFor="owner_name" className={labelClass}>
                  Nome completo (owner)
                </label>
                <input
                  id="owner_name"
                  required
                  value={form.owner_name}
                  onChange={(e) => update("owner_name", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="owner_email" className={labelClass}>
                  E-mail corporativo
                </label>
                <input
                  id="owner_email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.owner_email}
                  onChange={(e) => update("owner_email", e.target.value)}
                  className={inputClass}
                  placeholder="voce@empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="owner_password" className={labelClass}>
                  Senha
                </label>
                <input
                  id="owner_password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.owner_password}
                  onChange={(e) => update("owner_password", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="owner_password_confirm" className={labelClass}>
                  Confirmar senha
                </label>
                <input
                  id="owner_password_confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.owner_password_confirm}
                  onChange={(e) => update("owner_password_confirm", e.target.value)}
                  className={inputClass}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--obra-texto-2,#8b949e)]">
                <input
                  type="checkbox"
                  checked={form.aceite_termos}
                  onChange={(e) => update("aceite_termos", e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--obra-borda,#30363d)]"
                />
                <span>
                  Declaro que represento a empresa indicada e aceito os termos de uso da plataforma Obra10+ Hub.
                </span>
              </label>
              {msg && (
                <p
                  role="alert"
                  className="rounded-xl border border-[rgba(248,81,73,0.35)] bg-[rgba(179,38,30,0.08)] px-4 py-3 text-sm text-[#f0aba8]"
                >
                  {msg}
                </p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-12 rounded-xl border border-[var(--obra-borda,#30363d)] px-5 text-sm font-medium"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading || !form.aceite_termos}
                  className="min-h-12 flex-1 rounded-xl text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)] disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
                  }}
                >
                  {loading ? "A cadastrar…" : "Cadastrar empresa"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-8 text-center text-xs text-[var(--obra-texto-3,#484f58)]">
            Já tem conta?{" "}
            <Link href="/login" className="text-[var(--obra-dourado,#c9a24a)] hover:underline">
              Faça login
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
