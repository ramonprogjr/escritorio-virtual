-- Alinhamento Documento Mestre: slugs de ciclos do Diretor + base multi-tenant.
-- Executar no Supabase (SQL editor ou CLI). Sem DROP destrutivo.

-- 1) Tabela de tenants (Fase 4)
CREATE TABLE IF NOT EXISTS hub_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant padrão para dados legados (UUID fixo facilita app e RLS futura)
INSERT INTO hub_tenants (id, slug, nome_exibicao)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'obra10',
  'Obra10+'
)
ON CONFLICT (slug) DO NOTHING;

-- 2) Colunas tenant_id em tabelas centrais (nullable → backfill → NOT NULL opcional depois)
ALTER TABLE hub_leads_crm ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES hub_tenants(id);
ALTER TABLE hub_agente_identidade ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES hub_tenants(id);
ALTER TABLE hub_fila_mensagens ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES hub_tenants(id);
ALTER TABLE hub_parceiros ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES hub_tenants(id);

UPDATE hub_leads_crm SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE hub_agente_identidade SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE hub_fila_mensagens SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE hub_parceiros SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;

-- 3) Slugs de ciclos: tráfego → diretor_operacoes; restantes legados "diretor" → diretor_geral_ia
UPDATE hub_ciclos_ia
SET agente_slug = 'diretor_operacoes'
WHERE agente_slug = 'diretor'
  AND (
    nome ILIKE '%tráfego%'
    OR nome ILIKE '%trafego%'
    OR nome ILIKE '%campanha%'
  );

UPDATE hub_ciclos_ia
SET agente_slug = 'diretor_geral_ia'
WHERE agente_slug = 'diretor';

-- 4) Alertas antigos com slug inexistente (ajuste best-effort)
UPDATE hub_alertas SET agente_slug = 'diretor_geral_ia' WHERE agente_slug = 'diretor';
