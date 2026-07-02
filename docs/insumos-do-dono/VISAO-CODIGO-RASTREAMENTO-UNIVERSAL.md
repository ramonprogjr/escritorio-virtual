# 🧬 VISÃO DO DONO — Código como fio de rastreamento universal (02/jul/2026)

> Capturado ao vivo enquanto o dono explica (anti-perda). Base da **Maratona 2 (Serviço universal / coluna do fornecedor + operação de campo)**. Atualizar conforme ele acrescenta.

## Princípio-mãe
**O código é o fio que costura TUDO.** Todo **ator**, toda **ação** e toda **entidade** carrega um código, de modo que o sistema sempre responde: **QUEM · O QUÊ · ONDE · em QUAL NEGÓCIO**. Nada é anônimo, nada fica solto. É a base da auditoria (Hub + cura dos 5 medos), do **cérebro preditivo** (cruzamento pelos códigos = o moat) e do **split de comissão** na rede.

## Cenas concretas que o dono deu
1. **Mão de obra se cadastra → recebe um código** (`MDO-…`), vinculado ao fornecedor/empresa.
2. **Check-in na obra usa o código** → o sistema sabe **quem está no canteiro agora**.
3. **Pedido de material (totem/campo)** nasce carregando: **código de quem pediu + código da obra + do negócio + do fornecedor + do produto/serviço** → sei **quem pediu, de onde, em qual negócio**.
4. **Todas as entidades conectadas pelo código:** empresas, clientes finais, serviços, produtos — todos amarrados e rastreáveis pelo mesmo fio.

## Atribuição na ORIGEM (link de cadastro) — peça-chave
- **O link de cadastro carrega o código de quem o gerou** (empresa OU pessoa).
- Quem entra por aquele link — **pessoa, empresa, mão de obra ou produto** — **já nasce atrelado** a quem gerou o link.
- Assim sabemos automaticamente **a qual empresa/pessoa pertence** cada cadastro, sem vínculo manual depois.
- A **árvore de pertencimento se constrói sozinha na origem** (convite → cadastro herda o vínculo).

## Modelo de código (DEFINIÇÃO DO CEO — 02/jul, delegada pelo dono "ou o que o ceo definir")
Duas naturezas de código, não uma:
- **Camada 1 — IDENTIDADE (global, permanente, imutável, 1 por entidade real):** `PES-` (dedup CPF), `EMP-` (dedup CNPJ), `IMV-`, `PRD-`, `SVC-`. **É o MESMO código do cadastro E do acesso multi-tenant** (pedido do dono). O user/login APONTA pra ele, não cria outro. Muda de empresa/tenant → identidade intacta; muda só o vínculo temporal. **Identidade = global; acesso/papel = por-tenant** (1 pessoa na rede, N papéis por tenant).
- **Camada 2 — DOCUMENTO/TRANSAÇÃO (por-tenant, sequencial atômico):** `NEG-2026-0001`, `OBR-`, `CTR-`, `PROP-`, `ORC-`, `SC-`, `COM-`. Padrão já vivo (`crm_proximo_codigo`, `gerar_codigo_obra/sc`).
- **Por quê:** identidade estável cross-tenant vs artefato numerado por tenant. Juntar quebra ou o dedup (identity per-tenant) ou a numeração (documento global).

## Estado (live × gap) — honesto
- ✅ **Live:** código único por cadastro (contadores atômicos por tenant: `crm_proximo_codigo`, `gerar_codigo_obra`, `gerar_codigo_sc`), dedup CPF/CNPJ (`hub_pessoas_codigo_unique`), negócio como espinha, corrente SC → obra → negócio com `solicitado_por`, `hub_eventos` (keystone/log de tudo), esqueleto de links/indicação (`hub_links_cadastro`, `indicado_por`).
- 🔴 **Falta construir (Maratona 2):**
  - Código explícito da **mão de obra** amarrado ao **check-in** e ao **pedido de campo (totem)**.
  - Link de cadastro **embutindo o código do gerador** + **auto-atrelamento** valendo para **mão de obra e produto** (não só parceiro).
  - O "raio-x do fio": garantir que TODO evento relevante carrega os códigos certos, sem quebra de rastro.

## Relacionados (memória/docs)
`crm-prioridade-codigo-unico` · `integracao-contas-negocio-spine` · `operacao-campo-tablet-totem` · `especialistas-cadastro-mao-de-obra` · `monetizacao-licenciamento-rede` · `central-performance-metricas` (hub_eventos) · `modelo-tenant-first-servico-universal`.
