# PENDÊNCIAS PARA AMANHÃ CEDO (handoff da noite 02→03/jul)

> O que EU (CEO) avancei sozinho na noite está no fim. Aqui é o que **precisa de você** — nada foi aplicado à revelia.

---

## 🔴 1. RODAR SQL EM PROD (janela do dono — o classificador me barra, e está certo)

**a) Pacote de segurança RLS (eu deixo escrito e verificado — você roda em ordem):**
- `docs/JANELA-RLS-*.sql` (estou preparando ainda esta noite) — fecha o RESTO da auditoria M3:
  - RLS `authenticated` com `USING(true)` em ~várias tabelas hub_* + o schema legado inglês (leads/crm_deals/crm_persons) → tenant-scoped.
  - **Migração forward do "repo↔live drift"**: as migrações do repo ainda recriam políticas `anon` inseguras — um `supabase db reset`/ambiente novo nasceria vazando. A migração codifica o estado endurecido (no-op no banco atual).
  - **Backfill do tenant NULL** → só então trocar `tenantScopeOrFilter` (is.null+default) por `.eq` puro (o over-share vira vazamento no 2º tenant real).

**b) Migrações do "delete = arquiva" (5 endpoints que ainda são hard-delete — a coluna de arquivo não existe):**
- `hub_propostas` (CHECK de status sem valor de arquivo → add 'arquivada' no CHECK ou coluna `arquivado_em`)
- `hub_projetos_fases` (status é progresso + alimenta agregado → add `arquivado_em` + ajustar recontagem)
- `hub_agente_rag_documentos` (status é indexação + apaga binário do Storage → add `arquivado_em` + estratégia de arquivo no Storage + tirar da busca vetorial)
- `hub_pessoas_empresas` (vínculo N:N sem coluna de arquivo → add `arquivado_em`/`ativo`)
- `playbook-media` (só Storage, sem tabela → mover p/ prefixo `_arquivo/` ou criar tabela de mídias)

**c) Limpeza opcional:** dropar as RPCs de hard-delete que ficaram DORMENTES (não são mais chamadas): `hub_delete_pessoa_crm`, `hub_delete_empresa_crm`, `hub_delete_cargo_catalogo`, `hub_delete_ciclo_cascade`. E `lib/hub/delete-agente-completo.ts` virou código morto (candidato a remoção).

**d) Janela adiada (do backlog):** escrow #5 (GREATEST/FOR UPDATE) + **rotação das chaves Supabase #2** (fazer JUNTOS) + `.env` fora do OneDrive.

---

## 🟡 2. DECISÕES / VALIDAÇÃO SUA

- **Abrir LOGIN EXTERNO** (cliente/fornecedor/MDO): os 8 users do ecossistema estão **login-off** (`auth_id NULL`, Inativo). Ativar login = criar em `auth.users` + setar `auth_id`. **Só depois do E2E + mesa + segurança fechada** (é a trava que combinamos). Sua decisão.
- **Validação visual**: abrir o app deployado e conferir (1) o Consulado navegável por nome (Negócios → aba Arquitetura → raiz → Relacionados); (2) o "delete=arquiva" — mudou a semântica de `?ativo` em ciclos/canais/contatos/regras/autonomia (itens desativados por toggle agora também somem da lista padrão; só ciclos tem `?ativo=todos` como escape). Confirmar se alguma tela dependia de ver inativos por padrão.
- **"ponytail"**: você pediu "use o ponytail para códigos mais enxutos". **Não reconheço uma ferramenta com esse nome** no ambiente — apliquei a *intenção* (código enxuto). É uma tool/skill específica? Qual?

---

## 🔍 4. AUDITORIA QA DO SISTEMA (03/jul manhã) — relatório: docs/AUDITORIA-QA-SINTESE-CEO.md

8 equipes de QA (por domínio) + E2E ao vivo (chrome-devtools, logado como Hub, dado Consulado). **Veredito: o sistema É genérico/persona-cego, e a causa é ARQUITETURAL** — os agregadores filtram só por tenant, nunca por papel → todos veem o mesmo funil comercial.

**CEO fez sozinho (Wave 1 — código, gate verde, staging):** papel no Relacionados · tenant-NULL pedidos · funil zerado (legacyToFunil) · backtick relatórios · placeholder de código na busca. *(a validar)*

**DECISÕES DE PRODUTO suas (os "grandes"):**
- **Cockpit por persona (P0#1, fix-mãe):** proposta abaixo — aprovar o recorte pra eu subir a v1.
- **Fazer o dinheiro fluir (P0#2):** negócio-raiz R$150k não gera recebível/medição/escrow — semear + modelar MEDIÇÃO (não existe). Precisa SQL/janela.
- **Dupla-chave escrow (P0#3):** Chave 1 (Arq) e Chave 2 (Hub) são independentes hoje — modelar que UM pagamento exige AS DUAS.
- **`/crm/tarefas`:** renomear "Próximas ações (leads)" ou construir o Gestor universal?
- **Desambiguar fornecedores × parceiros × empresas-cadastro** (tripla sobreposição = fonte do "genérico") + `/crm/empresas` (escritórios) vs `[id]` (PJ).
- **Portal do fornecedor real** (`/fornecedor` é stub "protótipo").

### PROPOSTA — Cockpit por persona (validar antes da v1)
`aggregateDashboard(tenantId, papel)` recebe o papel do user (`users.role`) e monta o recorte; mantém "O que precisa de você" no topo de toda persona (a melhor peça). Cada uma ganha 3-5 cards acionáveis:
- **HUB** (owner): saúde do ecossistema (negócios-raiz+derivados, obras em risco, carteira/receita da rede, IA por tenant) + lente auditor.
- **Engenharia** (operation): obras em andamento · **medições a aprovar→pagamento** · pedidos c/ valor · avanço · cronograma. *(hoje NÃO tem dashboard)*
- **Arquiteto** (architect): fila projetos/briefings · aprovações · disparidade de orçamento · honorários · Chave 1 do escrow.
- **Serviços/Prestador**: só leads/OS encaminhados a ele + home própria.
- **Fornecedor**: cotações direcionadas + status propostas + pedidos a entregar.
- **Cliente** (client): status da obra (avanço/medições) · o que aprovar · **escrow**. *(hoje NÃO existe visão de cliente)*

Aditivo (o comercial atual vira o cockpit do papel commercial/HUB). **Aprovo e subo a v1 (HUB+engenharia+cliente primeiro), ou quer ajustar o recorte?**

---

## 🟢 3. O QUE EU FIZ SOZINHO NA NOITE (já no ar / commitado)

- **Maratona 3 code-safe** (commit e1a6849): 6 IDOR cross-tenant fechados + rate-limit em TODA rota de IA (anti-abuso) + saneamentos. Gate verde + revisão adversarial.
- **anon-RLS crítico FECHADO** (você rodou `APLICAR-URGENTE-RLS-anon.sql`): anon não apaga mais obras/projetos. Verificado ao vivo.
- **Ecossistema Consulado v2 APLICADO** (você rodou os 3 SQLs): raiz reancorada p/ ARQUITETURA (regra: raiz = 1º+principal negócio, qualquer mercado), 6 negócios com pipeline, grafo rico (arquiteto/engenharia/prestador/fornecedor/cliente), 8 vínculos com cargo, 8 users login-off, selo p/ rollback. Restore-point em `_rollback_consulado`.
- **delete = arquiva** (commit 9881fdc): 10 endpoints convertidos (nenhum user apaga de verdade). Gate verde.
- **DEPLOY** (f347d3b em feature/escritorio-visual): tudo acima no ar (staging Render), logins externos OFF.
- **E2E + mesa**: (em andamento nesta noite — relatório em `docs/E2E-*.md`).
- **Próxima maratona**: (se der tempo — decisões registradas p/ você revisar).

Ponto de retorno de código: tag `checkpoint-pre-ecossistema-consulado`. Rollback de dados: `docs/SEED-CONSULADO-V2-rollback.sql` (Modo A = arquivar).
