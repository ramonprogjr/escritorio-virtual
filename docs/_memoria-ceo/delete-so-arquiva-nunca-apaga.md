---
name: delete-so-arquiva-nunca-apaga
description: "Usuário do multi-tenant NUNCA apaga de verdade — \"delete\" SÓ ARQUIVA; o Hub retém tudo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

DIRETRIZ DO DONO (02/jul/2026, verbatim): "TUDO O QUE QUALQUER USUÁRIO DO MULTI TENANT APAGAR PARA O HUB SÓ ARQUIVA."

**Regra:** nenhuma ação de usuário faz HARD DELETE. Todo "apagar" na UI = **arquivar** (soft-delete: `arquivado_em`/`status='Inativo'`/`status='cancelado'`, conforme a tabela). O dado sai da tela e dos fluxos ativos, mas **permanece no banco** — o Hub nunca perde nada (rastreabilidade, auditoria, recuperação). É a face UX do "nada se apaga" [[spec-rastreabilidade-hub-blueprint]].

**Why:** o Hub é o selo de auditoria [[portal-cliente-medos-cura]]; se o usuário pudesse apagar, a linhagem/rastreio quebraria e o cliente perderia a garantia. Também protege contra erro/má-fé de um tenant destruir histórico.

**How to apply:**
- Endpoints de DELETE que hoje fazem hard-delete devem virar ARQUIVAR (ex.: canais-entrada/[id], distribuicao/regras/[id] DELETE — hoje deletam; converter p/ arquivado_em/ativo=false). SC já faz soft (status='cancelado'). Auditar todos os DELETE de usuário. (follow-up após M3.)
- Triggers já ajudam: `block_unauthorized_delete` barra DELETE em hub_pessoas/hub_empresas (escape só admin via `SET LOCAL app.delete_authorized=true`). Estender a lógica de "só arquiva" ao resto.
- Rollback/limpeza de seed = operação de ADMIN (não é user-delete) → pode hard-delete com autorização; mas PREFERIR o modo ARQUIVAR (Modo B) sempre que a entidade puder ter virado compartilhada. [[maratona3-auditoria-02jul]]
- Tabelas sem `arquivado_em` (hub_negocios/hub_servicos/users) usam `status` (fechado_perdido/cancelado/Inativo). Onde faltar coluna de arquivo, é candidato a migração aditiva (janela do dono).
