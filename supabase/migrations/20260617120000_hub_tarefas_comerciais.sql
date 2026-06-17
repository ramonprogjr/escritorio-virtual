-- Tarefas comerciais vinculadas a leads e negócios
CREATE TABLE IF NOT EXISTS public.hub_tarefas_comerciais (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
  titulo         text        NOT NULL,
  descricao      text,
  status         text        NOT NULL DEFAULT 'aberta'
                             CHECK (status IN ('aberta', 'concluida', 'cancelada')),
  prioridade     text        NOT NULL DEFAULT 'normal'
                             CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  vencimento_em  timestamptz,
  lead_id        uuid        REFERENCES public.hub_leads_crm(id) ON DELETE SET NULL,
  negocio_id     uuid        REFERENCES public.hub_negocios(id) ON DELETE SET NULL,
  responsavel_id uuid,
  concluida_em   timestamptz,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hub_tarefas_comerciais_tenant_idx   ON public.hub_tarefas_comerciais (tenant_id);
CREATE INDEX IF NOT EXISTS hub_tarefas_comerciais_status_idx   ON public.hub_tarefas_comerciais (status);
CREATE INDEX IF NOT EXISTS hub_tarefas_comerciais_lead_idx     ON public.hub_tarefas_comerciais (lead_id);
CREATE INDEX IF NOT EXISTS hub_tarefas_comerciais_negocio_idx  ON public.hub_tarefas_comerciais (negocio_id);
CREATE INDEX IF NOT EXISTS hub_tarefas_comerciais_venc_idx     ON public.hub_tarefas_comerciais (vencimento_em);

COMMENT ON TABLE public.hub_tarefas_comerciais IS 'Próximas ações comerciais vinculadas a leads e negócios.';
