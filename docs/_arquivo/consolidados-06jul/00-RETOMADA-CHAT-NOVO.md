# 🔑 RETOMADA — LEIA ISTO PRIMEIRO (handoff p/ o chat novo)
> Escrito em 03/jul/2026 (noite) porque o chat anterior ficou gigante ("prompt too long"). **Nada se perdeu** — está tudo commitado e na nuvem. Leia este doc, depois `docs/CONTROLE-MESTRE.md`, e continue.

## 👑 QUEM VOCÊ É (o contrato — não negociável)
Você é o **CEO** do projeto mais importante da vida do dono (Wendel). **NÃO bajule, seja honesto, pragmático, direto.** Discorde e aponte risco quando precisar. O CEO **avança e aprova** (o dono deu essa autoridade); o dono entra com considerações. Detalhe: memória `contrato-ceo-honesto-sem-bajulacao` + `processo-aprovacao-tela-e2e-mesa-ceo`.

## 🗂️ ONDE ESTÁ CADA COISA
| Material | Lugar |
|---|---|
| **Código** | `c:\Users\wende\Documents\escritorio-virtual-ramon` (branch **`wendel/dev`** = trabalho) |
| **Repo do dev** | github.com/ramonprogjr/escritorio-virtual (`origin`) → deploy sai de `feature/escritorio-visual` |
| **SEU backup** ✅ | github.com/**wendelnice-dev**/backup-sistema-01-hub (espelho completo) |
| **Memória do CEO** ✅ | **só** no seu backup, branch **`ceo-memory`** (fora do repo do dev, como você pediu). Também viva em `~/.claude/projects/.../memory/` |
| **Backup diário** | tarefa Windows `BackupHubDiario` 13:00 · script `C:\Users\wende\backup-hub-diario.ps1` |
| **Banco** | Supabase projeto `cdjlqsznerdhwqyunodl` (SISTEMA OBRA10+) — migração = janela do dono |
| **Deploy** | Render `escritorio-virtual-1.onrender.com` (login `nice.engemp@gmail.com`, role owner) |
| **Doc-raiz** ⭐ | `docs/CONTROLE-MESTRE.md` (roadmap+progresso+índice dos 142 docs+pendências) |
| **SQLs da janela** | `docs/JANELA-01/02/03-*.sql` · `docs/scratchpad`… (fora do git) p/ os privados |

## ✅ O QUE JÁ ESTÁ NO AR (pontos de avanço)
- **RBAC Onda 1** (63620f2): fonte única `lib/rbac/role-map.ts` (13 papéis) + fecha o 403 dos papéis em inglês + **escrow por CAPABILITY** (chave técnica = arquiteto OU engenharia). **E2E vivo comprovado: escrow liberou R$ 15.000** (2 autoridades humanas distintas, confirmado no banco). 2 revisões adversariais mataram 3 furos (over-grant, faixa-dinheiro, reject).
- **RBAC Onda 2** (4c7ddad): **fila de aprovações FILTRADA por persona** — arquiteto/engenharia veem/assinam só as chaves deles; nav persona-aware. Verificação de segurança: OK.
- **Antes:** QA Ondas 1-4 (cockpit persona, busca por nome, escrow no dashboard, botões mortos) + "aprovando já segue".
- **Nuvem/backup** ✅ + **CONTROLE-MESTRE** criado.

## 📐 DESIGNS APROVADOS (prontos p/ construir)
- **`docs/DESIGN-RBAC-MULTITENANT.md`** — matriz dos 13 papéis + multi-tenant. D1-D10 aceitos pelo dono + ressalva **escrow universal** (memória `escrow-universal-chave-tecnica-arq-ou-eng`).
- **`docs/DESIGN-TELA-ARQUITETO.md`** — a tela do arquiteto completa (5 superfícies: home macro→micro, **módulo financeiro 4 potes**, aba Financeiro, **Analytics tipo TV tempo real por contagem ao vivo**, relatórios). **Decisões do dono travadas: D1 = arquiteto é TENANT PRÓPRIO · D4 = travar SaaS+comissão · D5 = entrada do escrow MANUAL(MVP)+gateway(fase2) · D7 = pode aplicar a janela E6.** ⚠️ Achado de segurança: o financeiro não pode ser reusado cru (arquiteto veria a conta do Hub inteira) — precisa capability `financeiro:proprio` + recorte no dado.

## ▶️ PRÓXIMO PASSO EXATO (onde retomar)
**FILA 3 — Cadastro do PARCEIRO** (o dono pediu; o workflow caiu por REDE 2x → implementar **no loop principal**, não no workflow). **Contrato de segurança (obrigatório):**
1. Criar **`POST /api/crm/parceiros/route.ts`** com **`requireCrmComercial`** (espelha o especialista `app/api/crm/especialistas/route.ts:36`). NÃO reusar o POST público sem guard de `app/api/parceiros/route.ts:119`.
2. `tenant_id = g.ctx.tenantId` (sessão), **`.eq` puro**, nunca `defaultTenantId`/header; gravar `cadastrado_por = g.ctx.userId`; `comissao_pct` travado no server (não do body).
3. Dedup de CPF/CNPJ **tenant-scoped**; o 409 **não** vaza `parceiro_id`/código.
4. **Form manual** inline (nome, telefone, CPF/CNPJ, mercado, cidade/UF) espelhando o especialista, **responsivo**.
5. **Link 1-clique** no header (como o especialista faz — sem drawer), com `?por=userId` (quem convidou).
Depois: gate (tsc/vitest/build) → E2E → auditoria UI/UX → commit → deploy.

## 📋 FILA DEPOIS (na sequência)
- **FILA 4 — CONFIGURAÇÕES no menu** (self-service do RBAC: a empresa cadastra funcionários + permissões + settings).
- **BUILD Tela do Arquiteto** (após a janela E6/D7).
- **RBAC Onda 3** (ABAC fino por rota; endurecer o `comercial` de architect/operation).
- **Onda D — Sistema de LOGS** (erros + ações) — ver §7 do CONTROLE-MESTRE.

## 🧊 JANELA DO DONO (SQL/prod — o classificador barra; o dono cola e roda)
- `docs/JANELA-03-eng-responsavel-obra.sql` (coluna eng responsável) — pronto.
- **Janela E6** (migração `..._e6_financeiro_contrato_escrow.sql`) + fix #5 GREATEST + **rotação da `service_role`** (D7/D9 aprovados).
- Pacote RLS + backfill tenant-NULL (1 pessoa) + `.eq` puro no resolver de código.

## 🧹 LIMPEZA PENDENTE
- Remover login de teste `e2e-arq@obra10.app` (rollback no fim de `scratchpad/criar-e2e-arquiteto.sql`).
- Rollback do DEMO escrow (já liberou) quando o dono quiser (rollback em `JANELA-02`).
- `obradezmais@gmail.com` (hoje admin temporário do teste) → **owner** definitivo.

## ⚙️ COMO TRABALHAR (regras)
- Processo: **E2E ao vivo (chrome-devtools + verdade no banco) → mesa redonda → CEO ajusta E aprova → cada persona usa → dono considera.**
- Git: trabalha em `wendel/dev`; deploy = `git checkout wendel/dev -- .` em `feature/escritorio-visual` (**sem merge**). Gate: `tsc 0 · vitest · build 0`.
- Ferramentas: usar a MELHOR (regra eterna) — E2E=chrome-devtools MCP, DB=supabase MCP (read-only lib), UI=ui-ux-pro-max/dataviz. **Workflow** derruba por rede às vezes → nesses casos, implementar no loop principal.
- **Ao fim de cada onda:** atualizar CONTROLE-MESTRE + re-snapshot memória + backup.
