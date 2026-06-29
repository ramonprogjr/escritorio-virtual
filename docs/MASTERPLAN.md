Tenho tudo. Sintetizando o masterplan consolidado.

---

# MASTERPLAN CONSOLIDADO — Obra10+ (CRM IA-first / plataforma de obra+projeto)
*Norte do produto · CEO/Chief Architect · 29/jun/2026 · fiel aos insumos do dono e aos designs reais*

> **A régua (lei de tudo):** retirar DORES reais. Cada tela mostra a **CURA dos 5 MEDOS** do cliente (atrasar / não acabar / não saber / ser enganado / perder dinheiro). Honesto e justo, **sem mentiras** — a honestidade é a *arquitetura*, não uma feature. O **Hub é JUIZ** (engenharia auditorial + escrow, "somos juízes", não parte). **NADA SE PERDE** (append-only + soft-delete + Hub recupera). **Asset-light** (Obra10 orquestra; a rede cumpre). **PREDITIVO** (o cérebro da obra é o moat). **Click-and-Go / IA-first**, não-engessado, visão **curada por papel** (anti-poluição).

---

## 1. Visão em CAMADAS (a arquitetura do produto)

Sete camadas concêntricas. A de baixo já existe e sustenta tudo; cada uma acima **consome** a anterior — nunca reconstrói.

```
                    ┌─────────────────────────────────────────┐
        (7) HUB · juiz/auditoria/controle · gestão-da-gestão  │  DERIVA (sem captura)
            ┌───────────────────────────────────────────┐    │
   (6) PLATAFORMA transversal · negócio-espinha · nada-se-perde · mensageria · RBAC/ABAC
        ┌─────────────────────────────────────────┐
 (5) SUPERFÍCIES DE VALOR: PORTAL cliente · MARKETPLACE/iFood · CAMPO (tablet/totem)
     ┌───────────────────────────────────────┐
 (4) FINANCEIRO + ESCROW (2 modelos de contrato · custódia · dupla aprovação)
     ┌───────────────────────────────────┐
 (3) ENGENHARIA(obra) ‖ ARQUITETURA(projeto)  — irmãos, projeto alimenta obra
     ┌───────────────────────────────┐
 (2) A COLUNA / engine reusável (~90% pronta)
     ┌───────────────────────────┐
 (1) Núcleo CRM + multi-tenant + auth + marca dark verde+dourado
```

**(1) Núcleo + (2) A COLUNA (≈90% já existe — NÃO reconstruir).** Funil editável por mercado (`hub_pipelines`/`_estagios` + `PipelineConfigSideover`), Kanban-JOB (`/crm/negocios`), Copiloto voz+texto (`CopilotoVoz` + `/api/copiloto`, HMAC + gate dourado), engine IA + ferramentas (`lib/ia/engine`, registry de tools), RBAC (`crm-permissoes.ts`), multi-tenant (`current_user_tenant_id()`), `hub_obras`+sub-tabelas, `hub_projetos`+`_fases`, `hub_aprovacoes`, `hub_eventos` (log append-only), agregação por tenant (`cockpit-aggregate.ts`). **Tudo abaixo pluga aqui; quase nada é sistema novo.**

**(3) ENGENHARIA(obra) ‖ ARQUITETURA(projeto).** Espinha EAP (disciplina×andar) + Catálogo-dropdown; cockpit "Hoje" = fila de decisões; item×subitem (Situação automática × Andamento manual); restrições/bloqueios 1ª classe; Curva S c/ baseline; compras→estoque; medição; RDO voz/foto; fornecedores+score/SST. Arquitetura é o irmão mais leve (funil de projeto, programa de necessidades, aprovações do cliente) e **alimenta** a obra via elo "Gerar Obra".

**(4) FINANCEIRO + ESCROW.** `tipo_contrato` **imutável** bifurca o produto: **administração** (cliente vê unitário, gestão aberta) × **preço fechado** (só totais, turn-key). Escrow = custódia + liberação por **aprovação dupla (arquitetura + Hub)**; extrato append-only. MVP = escrow **virtual/contábil** (entrega a confiança sem banco real). É o mecanismo que VENDE ("só paga o aprovado, dupla chave, extrato imutável").

**(5) Superfícies de valor.** **PORTAL do cliente:** lente curada+auditada sobre o engine, dashboard-first, isolada por `negocio_id`; cada bloco cura um medo; selo de auditoria em 3 níveis (ⓥ/ⓘ/⚠). **MARKETPLACE/iFood:** camada sobre E5 (catálogo self-service do fornecedor + matching geo/ranking → `cotacoes_json`), spread honesto (preço-de-rede ou taxa transparente), frete por porte→veículo, predição (EAP→pedido antes do stockout = o moat), totem por voz, tracking iFood. **CAMPO:** check-in geo no equipamento-âncora do Hub, IA-campo (pergunta certa/hora certa/mínimo), cross-check declarado×evidência → vira restrição E3 auditada, hardware faseado (celular→kiosk→tablet-comodato).

**(6) PLATAFORMA transversal.** O **negócio (`hub_negocios`)**, origem na venda do imóvel, é a espinha que costura contas distintas (cliente/arquiteto/engenharia/fornecedor/Hub) pelo mesmo `negocio_id`; cada uma com seu `tenant_id` e sua visão (RBAC interno × ABAC por persona via `hub_negocio_acessos`). **Nada se perde** (3 camadas: soft-delete + `hub_eventos` imutável + Hub backstop). **Mensageria** por salas/papel pendurada no negócio. Projeto = **fonte única** (Engenharia lê da Arquitetura, não copia).

**(7) HUB · juiz.** Gestão-da-gestão/auditoria: agrega os tenants (mesmo aggregate sem `.eq(tenant_id)` via hub-admin) → Saúde da Rede, % no prazo por escritório, Curva S consolidada, alimenta o motor de distribuição. Processo humano de auditoria (eng/arq/eng-segurança/advogado/contador) dá lastro ao "selo" que o cliente vê. **Não tem telas de captura — DERIVA.**

---

## 2. STATUS atual (no ar · desenhado · falta)

**🟢 NO AR (Render, deployado e auditado):**
- **E0 + A0** — "Nova obra" Click-and-Go (EAP disciplina×andar, preset Reforma = 15 disciplinas do Consulado) + editor de EAP + carteira; **Arquitetura** `/crm/arquitetura` (funil de projeto editável, ficha em abas).
- **E1 cockpit** — `/crm/obras` = [Carteira][Hoje]; "Hoje" = fila de decisões (Atrasados · Próximos 15d · Bloqueios · Pagamentos). **Funciona ao vivo sem migração.**
- **E2 item×subitem** — Situação automática (prazo) × Andamento manual, por disciplina×andar.
- **E3 restrições** — os 5 bloqueios como restrição de 1ª classe (tabela + view de união + RPC; SST readonly; isolamento tenant exemplar).
- **A1** — programa de necessidades editável + aprovações do cliente.
- Gates verdes: tsc 0 erros · vitest 451/451 · build. Método: mesa redonda → auditoria adversarial → correção → deploy.

**🟡 EM AUDITORIA / recém-shipado localmente:**
- **E5 (compras→estoque)** — UI `ObraComprasEstoqueSecao` + aba integrada; tools `hub_obra_sc_criar`/`hub_obra_estoque_consultar`; testes verdes. Em validação.

**📐 DESENHADO + AUDITADO (pronto para construir):**
- **E6 REVISADO** (financeiro + 2 modelos de contrato + escrow dupla aprovação) · **A2** (elo "Gerar Obra") · **E4** (Curva S) — designs completos.
- **5 designs estratégicos** completos: PORTAL-CLIENTE, MARKETPLACE/iFood, CAMPO, PLATAFORMA-transversal, E6-financeiro+escrow.

**🔴 FALTA (ainda nem desenho de bloco fechado):** E7 (medição c/ gate) · E8 (RDO voz/foto) · E9 (fornecedores+score/SST) · E10 (copiloto executivo + agentes) · módulo **Serviços/cadeia de ofícios** (`hub_contratacao`, split por elo) · camada **Hub** completa.

**⚠️ Bloqueador de segurança confirmado no código:** `lib/ia/aprovacoes.ts` (`buscarAprovacoesPendentes`/`aprovar`/`rejeitar`) **não filtra `tenant_id`** — um escritório vê/aprova aprovações de outro. Latente hoje (~1 tenant em prod), mas E6 leva **dinheiro** a esse gate. **Fix é pré-requisito de go-live do financeiro, não opcional.**

---

## 3. ROADMAP em FASES (dependency-ordered)

### FASE 1 — Núcleo obra+projeto (quase pronto · "o cérebro da obra")
**Critério de pronto:** o gestor opera uma obra ponta-a-ponta sem planilha — cria (EAP), vê a fila do dia, acompanha avanço, bloqueia/destrava, prevê (Curva S), compra→estoque. Arquitetura cria projeto→aprova→gera obra.
- Restam: **migrações no ar** (janela do dono: E0→A0→E2→E3, depois E5) · **E5 fechar auditoria** · **E4 Curva S** · **A2 "Gerar Obra"** · fiação E3.5 (restrições no cockpit/itens).
- Habilita conversacional pleno com a chave Mistral (tudo funciona manual sem ela).

### FASE 2 — Confiança + cliente + fundação marketplace (o que VENDE)
**Critério de pronto:** o cliente dorme tranquilo (vê os 5 medos curados) e o dinheiro só anda com dupla chave auditada.
- **Pré-requisito duro:** fix de tenant em `lib/ia/aprovacoes.ts`.
- **E6 financeiro+escrow** (tipo_contrato bifurcado + gate duplo + escrow virtual + compatibilização + cockpit §4 acende).
- **PLATAFORMA-F0** (fundação invisível): `hub_eventos`+triggers genéricos, soft-delete padronizado, `negocio_id` nos elos faltantes → "nada se perde" vira verdade transversal.
- **PORTAL do cliente** (MVP read-mostly): persona `cliente` + login + `requirePortalSessao` + dashboard curado por `negocio_id` + selo honesto (ⓥ/ⓘ) + aprovações via máquina existente.
- **Mensageria-F2** (1 sala GERAL por negócio → multi-sala).
- **E7 medição** + **E8 RDO voz/foto** (alimentam diário/fotos do Portal).

### FASE 3 — Campo + marketplace pleno + cadeia + Hub (o moat operacional)
**Critério de pronto:** a obra se opera sozinha no campo (presença confiável + cross-check), o material chega antes de faltar, a rede transaciona com spread honesto, e o Hub audita a rede inteira.
- **MARKETPLACE Fase 2** (asset-light, determinístico, zero infra externa): catálogo self-service do fornecedor + matching geo/ranking → `cotacoes_json` (T2 de E5 inalterada) + frete por tabela estática + spread honesto + 4 KPIs + totem por voz + tracking + **predição v1** (regra estoque<necessidade — o moat).
- **CAMPO Fase 1→2**: check-in geo + IA-campo determinística → restrição E3; depois cross-check por visão; hardware celular→kiosk.
- **E9 fornecedores+score/SST** · **E10 copiloto executivo + agentes por nível** (acende com Mistral).
- **PLATAFORMA-F3/F4** (personas externas arquiteto/fornecedor + RLS cross-tenant + lixeira/recuperação com cara) · **HUB** (Saúde da Rede, auditoria, distribuição).
- **MARKETPLACE/CAMPO Fase 3** (Lalamove API real, **cadeia de ofícios** `hub_contratacao` + split por elo, aluguel de equipamento, ML preditivo, tablet-comodato premium). **Regra de ouro:** nada na Fase 2 depende de infra externa (Lalamove/ML/hardware) — protege o cold-start.

---

## 4. DEPENDÊNCIAS críticas + itens que dependem do DONO (janela)

**Cadeia técnica (não pular):**
`E0 (espinha EAP) → E2 (itens) → E5 (compras/estoque) → E6 (financeiro/escrow)`; `A0→A1→A2`; Curva S (E4) precisa dos pesos da EAP (E0); **Portal/Marketplace/Campo consomem** E2/E4/E5/E6 + a Plataforma-F0; **Hub deriva** de tudo.

**Dependem do DONO (travas):**
1. **Aplicar migrações** (aditivas/reversíveis/com backup) — ordem **E0→A0→E2→E3→E5**, depois E6 (`20260730120000`). Sem isso as telas não "acendem" 100%.
2. **MISTRAL_API_KEY** no Render — acende o conversacional pleno (manual funciona sem).
3. **Fix de tenant em `lib/ia/aprovacoes.ts`** — confirmar (segurança/dado sensível) **antes** de E6.
4. **Validar preset "Reforma Padrão"** vs planilha do Consulado.
5. **Smoke visual** juntos (desktop+mobile).
6. **Parceiro bancário/escrow real** (Fase 2 do E6: custo + credencial + compliance).
7. **Lalamove API** + **hardware de campo** (Fase 3: custo/logística).
8. **GitHub próprio de backup** (lembrete pendente).

---

## 5. CHECKPOINTS de negócio para o DONO (decisões em aberto)

Levantados pelas mesas; **não inventados** — registrados como pendência:

**Portal/transparência:** o cliente vê só o subconjunto honesto (avanço/cronograma/pagamentos dele/aprovações/fotos) ou mais? · selo automático (IA+amostragem) **vs** assinatura humana obrigatória antes de publicar? · cliente comenta/pede ajuste (vira pendência auditada) **vs** só vê+aprova? — *default proposto: cliente NÃO vê custo de fornecedor nem margem.*

**Financeiro/escrow:** política de **adiantamento sem orçamento** (permitir/bloquear/alçada)? · **alçada por valor** na 2ª chave? · **percentual/regra do spread** de gerenciamento? · provedor bancário da Fase 2? · imutabilidade do `tipo_contrato` desde a criação ou tolerante em planejamento?

**Marketplace/iFood:** **pesos do ranking** (preço/distância/SLA/frescor)? · **frete repassado vs spread** (recomendo separado/transparente no cold-start)? · **% de comissão por elo** da cadeia (3/4/2% ilustrativos)? · **modo de spread por contrato** (preço-de-rede vs taxa de serviço — admin força taxa transparente)? · gate humano para TODOS no início (recomendado)?

**Campo:** **tablet-comodato é condição de entrada** do fornecedor desde o teste, ou começa celular+geofence? · identificação do operário sem smartphone (PIN/QR/biometria)? · **KPIs iniciais** (recomendo 4: % no prazo · fill rate · frescor de preço · tempo de resposta)?

---

## 6. PRINCÍPIOS inegociáveis (a régua)

1. **Cura dos 5 medos** — cada elemento de tela do cliente mapeia a um medo→cura; atraso/estouro nunca escondidos (a UI não maquia).
2. **Honestidade estrutural** — o sistema é projetado para ser mais difícil mentir do que dizer a verdade (defesa na *query*, não na UI: preço fechado nunca seleciona unitário; selo nasce ⓘ até existir visita real).
3. **Hub é juiz** — engenharia auditorial (onboarding→visita in loco→IA de risco→escrow→métricas) + escrow dupla aprovação; a IA prepara, **nunca aprova dinheiro/prazo** — clique humano com papel, sempre. Aprovar por voz = proibido.
4. **Nada se perde** — append-only + soft-delete (nunca DELETE físico) + Hub backstop de recuperação.
5. **Asset-light** — Obra10 orquestra (trilho + demanda + predição + escrow + spread); a rede homologada cumpre/entrega; Lalamove para o urgente.
6. **Preditivo é o moat** — o cérebro da obra (EAP+cronograma+estoque+restrição) prevê a falta antes do peão; nenhum app genérico tem esse dado.
7. **Click-and-Go / IA-first** — preencher é escolher (chips/Catálogo) + confirmar; o copiloto é o controle remoto; voz no campo.
8. **Visão curada por papel (anti-poluição)** — cliente não vê entranhas da obra; arquiteto não vê entranhas da engenharia; margem/spread só o Hub.
9. **Aditivo e reversível** — migrações aditivas, reúso máximo da coluna, gates verdes (tsc+vitest+build) e auditoria adversarial antes de cada deploy; travas (irreversível/custo/credencial/produção) param e chamam o dono.

---

**Arquivos-âncora:** plano `docs/PLANO-BLOCOS-ARQ-ENG.md`; designs estratégicos `docs/PORTAL-CLIENTE-DESIGN.md`, `docs/MARKETPLACE-DESIGN.md`, `docs/CAMPO-DESIGN.md`, `docs/PLATAFORMA-DESIGN.md`, `docs/E6-DESIGN.md`; designs de bloco `docs/E0..E5-DESIGN.md`, `docs/A0..A2-DESIGN.md`; insumos do dono `docs/insumos-do-dono/`; estado `docs/RELATORIO-NOITE.md`. Bloqueador: `lib/ia/aprovacoes.ts` (tenant filter). Espinha: `hub_negocios` (`negocio_id`).