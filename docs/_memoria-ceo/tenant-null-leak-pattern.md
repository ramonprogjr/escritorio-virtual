---
name: tenant-null-leak-pattern
description: "Padrão SISTÊMICO de vazamento cross-tenant via tenant_id IS NULL legado (achado nas auditorias adversariais de E0 e A0) + a regra de correção a aplicar em TODO build novo"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**O furo (recorrente, confirmado nas auditorias de E0 e A0):** muitas tabelas `hub_*` têm `tenant_id` **NULLABLE** com linhas legadas `tenant_id IS NULL`. Como `crmDb()` usa **service-role (RLS bypassada)**, o filtro na camada de app é o ÚNICO isolamento. Aí dois anti-padrões vazam dados entre tenants:
- Leitura: `.or('tenant_id.eq.${X},tenant_id.is.null')` → qualquer tenant lê as linhas órfãs.
- Guarda de posse: `if (data.tenant_id && data.tenant_id !== tenant)` → o `&&` curto-circuita no NULL e trata a linha órfã como própria (permite ler E escrever).

**A REGRA (aplicar em TODA rota/tool/migração nova que toca `hub_*`):**
1. Leitura/escrita: `.eq('tenant_id', tenantId)` **puro** — nunca `.or(...is.null)`.
2. Guarda de posse: `if (data.tenant_id !== tenantId) → 404` (NULL = não-pertencente).
3. Migração: backfill da causa-raiz **antes dos índices** — `UPDATE public.<tabela> SET tenant_id = public.default_obra10_tenant_id() WHERE tenant_id IS NULL;` (idem nas tabelas-filhas, via JOIN no pai se não tiverem tenant_id próprio).
4. Tabela nova: `ENABLE ROW LEVEL SECURITY` + policy `tenant_id = current_user_tenant_id()` (defesa em profundidade, já que o app roda service-role).

**Onde apareceu:** E0 (`obras/[id]/eap`, `executar-ferramenta-obra` ×3) e A0 (`projetos` GET/[id]/programa ×5 + tools `arq_*` ×2; migração sem backfill). Ambos corrigidos antes do deploy.

**Diretriz operacional:** todo prompt de build da maratona Arq/Eng já cita esta regra; toda auditoria adversarial checa esse padrão primeiro. Ver [[metodo-auditoria-adversarial-validacao]], [[modo-operacional-code]], [[schema-rls-alinhamento-mestre]].
