"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Pedido = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  criado_em: string;
};

type Resposta = {
  id: string;
  fornecedor_nome: string;
  valor_total: number | null;
  prazo_dias: number | null;
  observacoes: string | null;
};

export default function CotacaoFornecedorPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fnome, setFnome] = useState("");
  const [fvalor, setFvalor] = useState("");
  const [fprazo, setFprazo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const carregarLista = useCallback(async () => {
    const r = await fetch("/api/cotacoes/pedidos", { headers: internalApiHeaders() });
    const j = await r.json();
    if (r.ok) setPedidos(j.pedidos || []);
  }, []);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  useEffect(() => {
    if (!selId) {
      setRespostas([]);
      return;
    }
    void (async () => {
      const r = await fetch(`/api/cotacoes/pedidos/${selId}`, { headers: internalApiHeaders() });
      const j = await r.json();
      if (r.ok) setRespostas(j.respostas || []);
    })();
  }, [selId]);

  async function criarPedido() {
    setLoading(true);
    setMsg(null);
    const r = await fetch("/api/cotacoes/pedidos", {
      method: "POST",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, descricao: descricao || null }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) {
      setMsg(j.erro || "Erro ao criar");
      return;
    }
    setTitulo("");
    setDescricao("");
    setSelId(j.pedido?.id || null);
    await carregarLista();
    setMsg("Pedido criado.");
  }

  async function addResposta() {
    if (!selId) {
      setMsg("Selecione ou crie um pedido.");
      return;
    }
    setLoading(true);
    setMsg(null);
    const r = await fetch(`/api/cotacoes/pedidos/${selId}/respostas`, {
      method: "POST",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        fornecedor_nome: fnome,
        valor_total: fvalor ? parseFloat(fvalor.replace(",", ".")) : null,
        prazo_dias: fprazo ? parseInt(fprazo, 10) : null,
      }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) {
      setMsg(j.erro || "Erro");
      return;
    }
    setFnome("");
    setFvalor("");
    setFprazo("");
    const rr = await fetch(`/api/cotacoes/pedidos/${selId}`, { headers: internalApiHeaders() });
    const jj = await rr.json();
    if (rr.ok) setRespostas(jj.respostas || []);
    setMsg("Resposta registrada.");
  }

  async function submeter() {
    if (!selId) return;
    setLoading(true);
    setMsg(null);
    const r = await fetch(`/api/cotacoes/pedidos/${selId}/submeter-aprovacao`, {
      method: "POST",
      headers: internalApiHeaders(),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) {
      setMsg(j.erro || "Erro");
      return;
    }
    setMsg(`Enviado à Central de Aprovações (id ${j.aprovacao_id}).`);
    await carregarLista();
  }

  return (
    <div className="px-4 py-10 max-w-lg mx-auto text-white">
      <p className="text-sm text-[#8b949e] mb-4">
        <Link href="/fornecedor" className="text-[#c9a24a] underline">← Voltar</Link>
      </p>
      <h1 className="text-xl font-bold mb-6 text-[#c9a24a]">Cotação</h1>

      {msg && <p className="text-sm mb-4 text-[#8b949e]">{msg}</p>}

      <section className="mb-8 rounded-lg border border-[#30363d] bg-[#161b22] p-4">
        <h2 className="text-sm font-bold text-[#e6edf3] mb-2">Novo pedido</h2>
        <input
          className="w-full mb-2 px-3 py-2 rounded bg-[#0d1117] border border-[#30363d] text-sm"
          placeholder="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <textarea
          className="w-full mb-2 px-3 py-2 rounded bg-[#0d1117] border border-[#30363d] text-sm min-h-[80px]"
          placeholder="Descrição / especificação"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void criarPedido()}
          className="px-4 py-2 rounded bg-[#003b26] text-sm font-medium disabled:opacity-50"
        >
          Criar pedido
        </button>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-bold mb-2">Pedidos recentes</h2>
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelId(p.id)}
                className={`w-full text-left px-3 py-2 rounded border text-sm ${
                  selId === p.id ? "border-[#c9a24a] bg-[#161b22]" : "border-[#30363d] bg-[#0d1117]"
                }`}
              >
                <span className="text-[#c9a24a]">{p.titulo}</span>
                <span className="text-[#484f58] text-xs ml-2">{p.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selId && (
        <>
          <section className="mb-8 rounded-lg border border-[#30363d] bg-[#161b22] p-4">
            <h2 className="text-sm font-bold mb-2">Adicionar proposta de fornecedor</h2>
            <input
              className="w-full mb-2 px-3 py-2 rounded bg-[#0d1117] border border-[#30363d] text-sm"
              placeholder="Nome do fornecedor"
              value={fnome}
              onChange={(e) => setFnome(e.target.value)}
            />
            <input
              className="w-full mb-2 px-3 py-2 rounded bg-[#0d1117] border border-[#30363d] text-sm"
              placeholder="Valor total (R$)"
              value={fvalor}
              onChange={(e) => setFvalor(e.target.value)}
            />
            <input
              className="w-full mb-2 px-3 py-2 rounded bg-[#0d1117] border border-[#30363d] text-sm"
              placeholder="Prazo (dias)"
              value={fprazo}
              onChange={(e) => setFprazo(e.target.value)}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void addResposta()}
              className="px-4 py-2 rounded bg-[#21262d] text-sm font-medium border border-[#30363d] disabled:opacity-50"
            >
              Registrar resposta
            </button>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-bold mb-2">Respostas ({respostas.length})</h2>
            <ul className="text-sm text-[#8b949e] space-y-1">
              {respostas.map((r) => (
                <li key={r.id}>
                  {r.fornecedor_nome} — R$ {r.valor_total ?? "—"} — {r.prazo_dias ?? "—"} dias
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={loading || respostas.length === 0}
              onClick={() => void submeter()}
              className="mt-4 px-4 py-2 rounded bg-[#c9a24a] text-[#0d1117] text-sm font-bold disabled:opacity-50"
            >
              Submeter para aprovação humana
            </button>
            <p className="text-xs text-[#484f58] mt-2">
              O card aparece em <Link href="/crm/aprovacoes" className="underline text-[#8b949e]">CRM / Aprovações</Link>.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
