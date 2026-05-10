-- Cotações fornecedor (Fase 3) + integração com aprovações humanas.

CREATE TABLE IF NOT EXISTS hub_cotacoes_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES hub_tenants(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'cotando', 'em_aprovacao', 'aprovado', 'rejeitado', 'cancelado')),
  aprovacao_id UUID REFERENCES hub_aprovacoes(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hub_cotacoes_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES hub_cotacoes_pedidos(id) ON DELETE CASCADE,
  fornecedor_nome TEXT NOT NULL,
  valor_total NUMERIC(12, 2),
  prazo_dias INTEGER,
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_cotacoes_pedidos_tenant ON hub_cotacoes_pedidos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_cotacoes_respostas_pedido ON hub_cotacoes_respostas(pedido_id);

UPDATE hub_cotacoes_pedidos
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

-- RLS alinhado às outras tabelas hub_* com tenant
ALTER TABLE hub_cotacoes_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_cotacoes_pedidos_anon ON hub_cotacoes_pedidos;
DROP POLICY IF EXISTS hub_cotacoes_pedidos_auth ON hub_cotacoes_pedidos;
CREATE POLICY hub_cotacoes_pedidos_anon ON hub_cotacoes_pedidos
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_cotacoes_pedidos_auth ON hub_cotacoes_pedidos
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());

ALTER TABLE hub_cotacoes_respostas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_cotacoes_respostas_anon ON hub_cotacoes_respostas;
DROP POLICY IF EXISTS hub_cotacoes_respostas_auth ON hub_cotacoes_respostas;
CREATE POLICY hub_cotacoes_respostas_anon ON hub_cotacoes_respostas
  FOR ALL TO anon
  USING (
    EXISTS (
      SELECT 1 FROM hub_cotacoes_pedidos p
      WHERE p.id = hub_cotacoes_respostas.pedido_id
        AND p.tenant_id = default_obra10_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hub_cotacoes_pedidos p
      WHERE p.id = hub_cotacoes_respostas.pedido_id
        AND p.tenant_id = default_obra10_tenant_id()
    )
  );
CREATE POLICY hub_cotacoes_respostas_auth ON hub_cotacoes_respostas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM hub_cotacoes_pedidos p
      WHERE p.id = hub_cotacoes_respostas.pedido_id
        AND p.tenant_id = app_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hub_cotacoes_pedidos p
      WHERE p.id = hub_cotacoes_respostas.pedido_id
        AND p.tenant_id = app_tenant_id()
    )
  );
