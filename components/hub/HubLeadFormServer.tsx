import { submitLeadHub } from "@/app/cadastre-se/actions";

type Props = {
  ok?: string;
  erro?: string;
  email?: string;
};

const inputClass =
  "w-full rounded-xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] px-4 py-3 text-[15px] text-[var(--obra-texto,#e6edf3)] placeholder:text-[var(--obra-texto-3,#484f58)] focus:border-[var(--obra-dourado,#c9a24a)] focus:outline-none focus:ring-1 focus:ring-[var(--obra-dourado,#c9a24a)]/35";
const labelClass = "text-xs font-medium uppercase tracking-wide text-[var(--obra-texto-2,#8b949e)]";
const cardClass =
  "rounded-2xl border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)] p-6 sm:p-8";

export function HubLeadFormServer({ ok, erro, email }: Props) {
  if (ok === "1") {
    return (
      <div className={cardClass} id="cadastre">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
            style={{ background: "rgba(35,134,54,0.2)", color: "#3fb950" }}
            aria-hidden
          >
            ✓
          </div>
          <h2 className="mt-4 text-xl font-bold text-[var(--obra-texto,#e6edf3)]">Pedido recebido</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--obra-texto-2,#8b949e)]">
            Registramos o seu interesse. A nossa equipe entrará em contato em breve
            {email ? (
              <>
                {" "}
                no e-mail <strong className="text-[var(--obra-texto,#e6edf3)]">{email}</strong>
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass} id="cadastre">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-[var(--obra-texto,#e6edf3)]">Cadastre-se no Hub</h2>
        <p className="mt-1 text-xs text-[var(--obra-texto-2,#8b949e)]">
          Empresa, contato e telefone — entramos no funil comercial.
        </p>
      </div>

      <form action={submitLeadHub} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label htmlFor="hub_empresa" className={labelClass}>
            Empresa
          </label>
          <input
            id="hub_empresa"
            name="empresa"
            required
            minLength={2}
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
            name="nome"
            required
            minLength={2}
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
            name="email"
            type="email"
            required
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
            name="telefone"
            type="tel"
            required
            className={inputClass}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
          />
        </div>

        {erro ? (
          <p
            role="alert"
            className="rounded-xl border border-[rgba(248,81,73,0.35)] bg-[rgba(179,38,30,0.08)] px-4 py-3 text-sm text-[#f0aba8]"
          >
            {erro}
          </p>
        ) : null}

        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)]"
          style={{
            background:
              "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
          }}
        >
          Quero conhecer o Hub
        </button>

        <p className="text-center text-[10px] text-[var(--obra-texto-3,#484f58)]">
          Ao enviar, autoriza contato comercial sobre o Obra10+ Hub.
        </p>
      </form>
    </div>
  );
}
