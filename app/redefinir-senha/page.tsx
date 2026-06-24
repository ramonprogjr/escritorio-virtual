"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Obra10BrandHeader } from "@/components/brand/Obra10Brand";

/**
 * /redefinir-senha — conclui o "Esqueci minha senha". O usuário chega aqui pelo link do
 * e-mail (Supabase abre uma sessão de RECOVERY automaticamente, detectSessionInUrl). A página
 * confirma que há sessão de recuperação e deixa definir a nova senha (auth.updateUser).
 * Sem sessão válida → orienta a pedir um novo link. Design system Obra10+.
 */
const inputCls =
  "w-full rounded-xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] py-3 pl-4 pr-12 text-[15px] text-[var(--obra-texto,#e6edf3)] transition-[border-color,box-shadow] placeholder:text-[var(--obra-texto-3,#484f58)] focus:border-[var(--obra-dourado,#c9a24a)] focus:outline-none focus:ring-1 focus:ring-[var(--obra-dourado,#c9a24a)]/35";

const labelCls = "text-xs font-medium uppercase tracking-wide text-[var(--obra-texto-2,#8b949e)]";

export default function RedefinirSenhaPage() {
  const [estado, setEstado] = useState<"verificando" | "pronto" | "sem_sessao" | "concluido">(
    "verificando",
  );
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // O link de recuperação estabelece uma sessão de RECOVERY (detectSessionInUrl). Aguardamos
  // o evento PASSWORD_RECOVERY ou uma sessão já presente; senão, marcamos "sem sessão".
  useEffect(() => {
    let ativo = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ativo) return;
      if (event === "PASSWORD_RECOVERY" || session) setEstado("pronto");
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setEstado((prev) => (prev === "concluido" ? prev : data.session ? "pronto" : "sem_sessao"));
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (senha.length < 8) {
      setMsg("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setMsg("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        setLoading(false);
        setMsg(error.message);
        return;
      }
      // Encerra a sessão de recuperação para o usuário entrar de novo com a nova senha.
      await supabase.auth.signOut();
      setLoading(false);
      setEstado("concluido");
    } catch {
      setLoading(false);
      setMsg("Não foi possível redefinir a senha. Tente novamente.");
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--obra-dark,#0d1117)] px-6 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-10">
          <Obra10BrandHeader
            size="lg"
            subtitle="Plataforma"
            subtitleClassName="!text-[var(--obra-dourado,#c9a24a)] !tracking-[0.12em]"
          />
        </div>

        <h1 className="mb-6 text-xl font-semibold text-[var(--obra-texto,#e6edf3)]">Redefinir senha</h1>

        {estado === "verificando" && (
          <p className="text-sm text-[var(--obra-texto-2,#8b949e)]">Verificando o link…</p>
        )}

        {estado === "sem_sessao" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[rgba(248,81,73,0.35)] bg-[rgba(179,38,30,0.08)] px-4 py-3 text-sm leading-snug text-[#f0aba8]">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </div>
            <Link
              href="/login"
              className="text-center text-sm font-medium text-[var(--obra-dourado,#c9a24a)] hover:underline"
            >
              ← Voltar ao login
            </Link>
          </div>
        )}

        {estado === "concluido" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[rgba(63,185,80,0.35)] bg-[rgba(63,185,80,0.08)] px-4 py-3 text-sm leading-snug text-[#7ee2a8]">
              Senha redefinida com sucesso. Entre com a nova senha.
            </div>
            <Link
              href="/login"
              className="w-full rounded-xl border border-[rgba(201,162,74,0.22)] py-3.5 text-center text-[15px] font-semibold tracking-wide text-[var(--obra-dourado-light,#e0b86a)]"
              style={{
                background: "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
              }}
            >
              Ir para o login
            </Link>
          </div>
        )}

        {estado === "pronto" && (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <label htmlFor="nova-senha" className={labelCls}>
                Nova senha
              </label>
              <div className="relative">
                <input
                  id="nova-senha"
                  type={mostrar ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className={inputCls}
                />
                <button
                  type="button"
                  aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-xl text-[var(--obra-texto-2,#8b949e)] transition-colors hover:text-[var(--obra-dourado,#c9a24a)]"
                  onClick={() => setMostrar((v) => !v)}
                >
                  {mostrar ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmar-senha" className={labelCls}>
                Confirmar nova senha
              </label>
              <input
                id="confirmar-senha"
                type={mostrar ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a senha"
                className="w-full rounded-xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] px-4 py-3 text-[15px] text-[var(--obra-texto,#e6edf3)] transition-[border-color,box-shadow] placeholder:text-[var(--obra-texto-3,#484f58)] focus:border-[var(--obra-dourado,#c9a24a)] focus:outline-none focus:ring-1 focus:ring-[var(--obra-dourado,#c9a24a)]/35"
              />
            </div>

            {msg && (
              <div
                role="alert"
                className="rounded-xl border border-[rgba(248,81,73,0.35)] bg-[rgba(179,38,30,0.08)] px-4 py-3 text-sm leading-snug text-[#f0aba8]"
              >
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-[rgba(201,162,74,0.22)] py-3.5 text-[15px] font-semibold tracking-wide text-[var(--obra-dourado-light,#e0b86a)] transition-[transform,opacity] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-55"
              style={{
                background: "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Salvando…" : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
