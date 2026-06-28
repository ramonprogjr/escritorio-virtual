-- FASE A (consolidação parceiro→fornecedor) — passos 8 e 9.
-- APLICADO em 28/jun via Management API (MCP estava off); versionado aqui para rastreio.
-- Aditivo e REVERSÍVEL. O motor de distribuição só passa a ler hub_fornecedores quando a
-- env MOTOR_FONTE=fornecedores (default 'parceiros' = comportamento atual). Validado lado a
-- lado: os 5 candidatos homologados têm score idêntico nas duas fontes.

-- Passo 8 — colunas-espelho que o motor (lib/crm/distribuir-lead.ts) precisa:
ALTER TABLE public.hub_fornecedores
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS total_leads_recebidos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_financeiro TEXT DEFAULT 'em_dia',
  ADD COLUMN IF NOT EXISTS origem_parceiro_id UUID;

-- Passo 9 — backfill idempotente dos parceiros → fornecedores (preserva id; origem_parceiro_id
-- = rastreio + rollback; status_acesso por MENOR PRIVILÉGIO; mercados é JSONB).
INSERT INTO public.hub_fornecedores
  (id, codigo, nome, cpf, cnpj, email, telefone, especialidade, mercados, mercado_principal,
   cidade, estado, status_acesso, status, recebe_leads, total_leads_recebidos, status_financeiro,
   comissao_pct, tenant_id, origem_parceiro_id, criado_em, atualizado_em)
SELECT p.id, p.codigo, p.nome, p.cpf, p.cnpj, p.email, p.telefone, p.especialidade,
       CASE WHEN p.mercado IS NOT NULL AND p.mercado <> '' THEN jsonb_build_array(p.mercado) ELSE '[]'::jsonb END,
       p.mercado, p.cidade, p.estado,
       CASE WHEN p.status = 'homologado' THEN 'aprovado' ELSE 'pendente' END,
       p.status, p.recebe_leads, COALESCE(p.total_leads_recebidos, 0),
       COALESCE(p.status_financeiro, 'em_dia'), p.comissao_pct,
       COALESCE(p.tenant_id, '00000000-0000-4000-8000-000000000001'::uuid),
       p.id, p.criado_em, now()
FROM public.hub_parceiros p
ON CONFLICT (id) DO UPDATE SET
  mercados = EXCLUDED.mercados, mercado_principal = EXCLUDED.mercado_principal,
  status_acesso = EXCLUDED.status_acesso, status = EXCLUDED.status,
  recebe_leads = EXCLUDED.recebe_leads, total_leads_recebidos = EXCLUDED.total_leads_recebidos,
  status_financeiro = EXCLUDED.status_financeiro, origem_parceiro_id = EXCLUDED.origem_parceiro_id,
  atualizado_em = now();

-- ─── ROLLBACK (não aplicar a menos que precise desfazer a Fase A) ──────────────
--   DELETE FROM public.hub_fornecedores WHERE origem_parceiro_id IS NOT NULL;  -- remove só o backfill
--   ALTER TABLE public.hub_fornecedores
--     DROP COLUMN IF EXISTS origem_parceiro_id, DROP COLUMN IF EXISTS status,
--     DROP COLUMN IF EXISTS total_leads_recebidos, DROP COLUMN IF EXISTS status_financeiro;
--   (e garantir MOTOR_FONTE=parceiros)
