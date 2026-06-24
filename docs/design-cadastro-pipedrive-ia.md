# Design — Cadastro relacional estilo Pipedrive + campos Membros + IA-first

**Data:** 2026-06-24 · **Escopo:** CRM cliente-final (`-ramon`) · **Status:** plano (aguardando GO; nada codado)

## Princípio
Pessoa ↔ Empresa ↔ Negócio ↔ Produto **cruzados e navegáveis em 1 clique** (modelo Pipedrive),
com **campos ricos do sistema Membros**, **rastreio por código tipo-CPF** (já implementado:
PS2026001 / NGIMB2026001), e **IA-first** tecida em cada ponto. Negócio é o centro.

## Mapa Pipedrive → -ramon (o que já existe)
| Pipedrive | -ramon hoje | Lacuna |
|---|---|---|
| Person / Organization / Deal | `hub_pessoas` / `hub_empresas` / `hub_negocios` (liga pessoa_id, empresa_id, lead_id) | vínculo do negócio é **rígido** (pessoa_id NOT NULL) |
| Lead Inbox → Deal | `hub_leads_crm` + converter-negocio | ok |
| Products no Deal (line items) | `hub_servicos` / catálogo parcial | falta **itens do negócio** (qtd×preço) |
| Activities / Timeline | `hub_atividades` (lead/negocio/pessoa) | falta **timeline unificada** na ficha |
| Pipeline Kanban | pipelines por mercado (negócio já auto-resolve) | ok |
| Detail view correlacionada | telas existem isoladas | falta o **cruzamento navegável** |

---

## Fase 1 — Modelo relacional (fundação, migrações aditivas)
1. **Vínculo flexível do negócio:** relaxar `hub_negocios.pessoa_id` para nullable → negócio liga
   **pessoa E/OU empresa** (como Pipedrive). Manter a regra "ganho exige pessoa" só na transição
   para ganho (não na criação). *Risco:* checar dependências da NOT NULL (validação de ganho).
2. **Pessoa ↔ Empresa:** consolidar `hub_pessoas.empresa_id` como empresa primária + permitir
   uma pessoa aparecer nos contatos de uma empresa.
3. **Produtos como itens do negócio:** nova tabela `hub_negocio_itens`
   (negocio_id, produto_id/servico_id, descricao, quantidade, preco_unit, total, tenant_id) +
   recalcular `valor_estimado` do negócio a partir dos itens.
4. Tudo tenant-scoped + RLS (mesmo padrão do Bloco E) + códigos (PD/SV para produto/serviço).

## Fase 2 — Fichas de detalhe correlacionadas (a "mágica" do Pipedrive)
- **Ficha do Negócio:** centro + painéis laterais → **Pessoa** (card clicável), **Empresa**,
  **Produtos/itens**, **Timeline** (atividades + mudanças de etapa), **próxima ação**. Botões
  rápidos: ligar pessoa/empresa, adicionar produto, registrar atividade, marcar ganho/perda.
- **Ficha da Pessoa:** dados + Empresa + **lista de Negócios** + Atividades + timeline.
- **Ficha da Empresa:** dados + **Contatos (pessoas)** + Negócios + Atividades.
- Navegação 1-clique entre fichas (por código/id). Reusar o `⌘K` para pular entre entidades.

## Fase 3 — Campos ricos (Membros) + catálogo de produtos
- Pessoa/Empresa ganham os campos úteis do Membros (mercados, área, origem, documento, endereço,
  redes) — só o que faz sentido para cliente-final (homologação fica no CRM de Membros).
- Catálogo `hub_servicos`/produtos com preço/unidade, para alimentar os itens do negócio.

## Fase 4 — IA-first (tecida em tudo; começa heurística, pluga LLM depois)
- **No cadastro:** dedup automática (telefone/CPF/CNPJ), **sugestão de vínculo** (essa pessoa é
  desta empresa?), enriquecimento, normalização. *(heurística pura primeiro — sem custo.)*
- **No negócio:** IA sugere **produtos**, **próxima ação**, **resumo da timeline**, score/probabilidade.
- **Busca:** estender `⌘K` para pessoas/empresas/negócios por nome **ou código**.
- Provider: hoje Mistral; Anthropic dormente (Bloco H) — a camada de sugestão é desenhada
  **provider-agnóstica**, ligando o LLM quando houver chave/custo aprovado.

## Sequência sugerida & travas
F1 → F2 → F3 → F4, cada fase com migração aditiva + prova logada + commit local (sem deploy).
Começo recomendado: **F1 item 1 (vínculo flexível) + F2 ficha do Negócio** = maior impacto visível.
IA-first entra desde a F1 como heurística (sem custo), e ganha LLM no Bloco H.

> Nada aqui foi codado. Aguardando GO para iniciar (sugiro F1+F2).
