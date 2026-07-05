---
name: especialistas-cadastro-mao-de-obra
description: REQUISITO — cadastro de Especialistas (mão de obra/terceiros) SEPARADO dentro de Cadastros; NÃO ganham acesso ao sistema (sem login), só entram na base de dados vinculados a quem cadastra; form bonito em CHIPS (ref. sistema Membros)
metadata:
  type: project
---

Pedido do Wendel (25/jun/2026): o **cadastro de Especialistas** (mão de obra / terceiros: pedreiro, eletricista, pintor, encanador, etc.) deve ser um **tipo separado DENTRO de Cadastros** no -ramon.

**Regra de negócio (essencial):** especialistas **NÃO ganham acesso ao sistema** (sem login/usuário/tenant) — diferente de empresa homologada (que vira tenant). Eles só **entram na BASE DE DADOS**, **vinculados ao fornecedor/empresa que os cadastra** (mão de obra própria/terceirizada daquele fornecedor). É a base de recursos de execução de obra.

**Referência de design (o Wendel curtiu — fácil/bonito/funcional):** o modal "Cadastrar mão de obra" do **sistema Membros** (`obra10-membros.html`):
- **Nome\*** · **Celular/WhatsApp\*** · **Cidade\*** · **UF**
- **Especialidades\*** em **CHIPS de múltipla escolha** (Empreiteiro, Pedreiro, Pintor, Eletricista, Encanador/Hidráulica, Serralheiro, Vidraceiro, Gesseiro/Drywall, Azulejista/Ceramista, Marceneiro, Carpinteiro, Instalador de Ar-condicionado, Soldador, Telhadista, Impermeabilizador, Marmoraria/Granito, Pisos e Revestimentos, Forro/PVC/Drywall, Jardinagem/Paisagismo, Limpeza pós-obra, Ajudante/Servente)
- **Trabalha sozinho / Tem equipe** (toggle de 2 botões)
- **Tempo de experiência** (select)
- Botão **Cadastrar** (Click-and-Go, sem digitação onde dá pra escolher).

**Requisito complementar (Wendel, 25/jun) — convite + rastreio + código único:**
- **Dois caminhos de cadastro:** (a) **manual** (o form em chips) e (b) **link de convite público** que o membro/fornecedor/qualquer um envia → o especialista se cadastra sozinho (sem login) e cai na base. Espelhar o fluxo público já existente `app/parceiro/cadastro/[token]/page.tsx` + `app/api/parceiro/cadastro-publico/route.ts`.
- **Rastreio obrigatório — "mão de obra de QUEM":** registrar **através de quem** o especialista veio (`convidado_por`/`cadastrado_por` = user/membro/fornecedor que convidou ou cadastrou) + `origem` (manual vs link). O `tenant_id` já dá o fornecedor; falta o usuário/origem específico. Tudo rastreado.
- **CPF único (código único):** todo especialista deve ter um identificador **único** (CPF) — deduplicar por CPF/telefone (não duplicar a mesma pessoa na base), além do código ESP-YYYY-NNNN que já existe. Casa com [[crm-prioridade-codigo-unico]].

**ENTREGUE (25/jun, commits f9266c0 + b31a5fe):**
- Rastreio: POST grava `cadastrado_por` (coluna já existia). "Mão de obra de quem" ✅ no cadastro manual.
- **Link de convite público** ✅ verificado ponta a ponta: `app/especialista/cadastro` (página pública, form em chips, sem login, lê `?por=`) + `POST /api/public/especialista` (rate-limited, `origem='link'`, `cadastrado_por`=convidador) + `GET /api/crm/especialistas/convite` (devolve userId da sessão) + botão "Convidar (link)" na tela. Taxonomia em `lib/crm/especialidades.ts`. Single-tenant hoje; TODO B3.9: derivar tenant do convidador.
- Atalho "Mão de obra" no cabeçalho de /crm/cadastro ✅.

**FALTA (lote-fim, precisa migração):** coluna **CPF** (em `docs/sql/PENDENTES-aplicar-no-fim.sql`) + **dedup por CPF/telefone** no POST (interno e público) após aplicar a coluna.

**Já existe no -ramon:** `app/crm/especialistas/page.tsx` + `app/api/crm/especialistas/route.ts` (entidade de especialistas) — **reaproveitar/alinhar** a esse design e à regra "sem acesso". Verificar a taxonomia de especialidades existente vs a do Membros (unificar). Entra dentro do grupo **Cadastros** (PF/PJ unificado + Especialista). Casa com [[ceo-mandato-produto]] (telas para o job), [[feedback-funcional-nao-fachada]], [[ux-principio-click-talk-go]] (chips), [[membros-cadastro-formato]] (Membros é o sistema-fonte do design; INTOCÁVEL).
