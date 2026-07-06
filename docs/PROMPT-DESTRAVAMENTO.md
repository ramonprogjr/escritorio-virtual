# 🔓 PROMPT — Destravamento do sistema Obra10+ (o que foi feito e por quê)
> Cole isto num chat novo para dar contexto, ou passe ao dev. Explica como o sistema foi **organizado, limpo e desacoplado** para que uma coisa pare de quebrar a outra.

---

**Sistema:** Obra10+ / Escritório Virtual — Next.js (app router) + Supabase, multi-tenant, IA-first. Branch de trabalho `wendel/dev`; deploy por overlay em `feature/escritorio-visual` (Render). Regra: migração em prod / bucket = janela do dono; gate obrigatório `tsc 0 · next build 0 · vitest` antes de todo commit; commits pequenos e isolados; nada vai a produção sem a validação visual do dono.

## O problema
O sistema estava **acoplado**: mexer num botão/tela quebrava outra. Uma auditoria de 4 frentes (organização · acoplamento · saúde de código · rede de testes) mostrou que a causa **não era código ruim** — era **estrutural e de higiene**:
- **~11% do repo era código MORTO** (um produto anterior inteiro, o "escritório virtual", desativado mas nunca removido; + formulários órfãos de refatorações antigas).
- O acoplamento real **não estava nos arquivos gigantes** (esses têm fan-in 0–1). Estava em **4 módulos pequenos e invisíveis**: `lib/tenant-default.ts` (importado por 112 telas), o cliente Supabase reimplementado à mão em **82 rotas**, o `app/crm/layout.tsx` (um único layout que envolve **as 52 telas do CRM**), e o RBAC espalhado em 3 superfícies.
- A rede de testes passava (tsc/vitest/build), mas **nenhum teste abria uma tela** e o `next build` **nem rodava no CI** → quebra de UI chegava ao deploy sem nada acender.

## O método — a ORDEM importa: LIMPAR → PROTEGER → DESTRAVAR → TRAVAR
(Refatorar os pontos acoplados primeiro seria repetir o erro. Sem rede, não se mexe no acoplado.)

**1. LIMPAR (risco zero).** Removi **~17.500 linhas de código morto** em commits isolados (cada um com gate verde): o cluster "escritório virtual" (~55 arquivos), 15 formulários órfãos, helpers de hard-delete dormentes. Arquivei 56 docs de memória mortos. → base legível.

**2. PROTEGER (a rede ANTES de refatorar).**
- `next build` no **CI** (antes só tsc+vitest — a quebra que só o build pega escapava).
- Rede de testes das **superfícies compartilhadas**: as 3 camadas de RBAC (mapa de papéis + guard de rota + menu por papel) + infra de render. De **766 → ~800 testes**. Trava "menu errado / 403 / tela quebra ao mexer no compartilhado".

**3. DESTRAVAR (com a rede no ar).**
- **Unifiquei 66 clientes Supabase duplicados** num único `crmDb` (−613 linhas). Antes, uma correção de segurança tinha que ser replicada em ~172 lugares; agora se propaga sozinha.
- **Nomeei o perigo do tenant:** criei `tenantScopeExact` (a opção segura para tabela privada) + um teste que trava a distinção — o helper antigo (`tenantScopeOrFilter`) inclui `tenant_id NULL` e já tinha causado vazamento de dados entre clientes.
- **Extraí o `app/crm/layout.tsx`** (o "ground zero" que envolvia as 52 telas) em **CrmShell** (a casca visual) + **CrmLayout** (bootstrap de sessão/guard). Agora um bug de CSS na casca não derruba mais a autenticação das 52 telas — e vice-versa. Verificado por mesa crítica (movimentação pura, 0 achados) + gate verde.

**4. TRAVAR (anti-reincidência).** O `next build` no CI + os testes das superfícies compartilhadas fazem uma mudança nova que quebraria outra tela ser pega **antes do deploy**.

## Resultado
- Sistema **legível** (−17.500 linhas de ruído) e **navegável** (docs organizados; uma porta de entrada, o `CONTROLE-MESTRE.md`).
- **Mudança num lugar parou de respingar nas outras telas** (clientes unificados, layout isolado, RBAC travado por teste).
- A **rede pega a quebra antes do deploy**.
- O trabalho virou **cirúrgico**: mexer num item = mexer só nele. Foi isso que, na sequência, permitiu **consertar bugs pontuais e adicionar features sem medo** — ex.: o bug do fluxo venda→obra→recebível, propostas na ficha do negócio, e o Diário de Obra — cada um isolado, gated e sem quebrar o resto.

## O que ainda depende do dono
Rodar a **janela de banco** (buckets de mídia, tabela de erros, colunas ricas de medição/RDO — ver `docs/JANELA-STORAGE-LOGS-NF.md`) + 2 decisões (bucket público×privado; nota fiscal anexar×emitir) + o dev setar `COPILOTO_HMAC_SECRET` no Render. Depois disso, a camada rica (mídia, medição completa, RDO completo) é construída por cima da base já limpa.
