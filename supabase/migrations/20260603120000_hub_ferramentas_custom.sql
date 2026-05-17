-- Ferramentas Hub customizáveis por tenant (wrapper sobre builtins + smart layer opcional).

CREATE TABLE IF NOT EXISTS public.hub_ferramentas_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.hub_tenants (id) ON DELETE CASCADE,
  ferramenta_key text NOT NULL,
  titulo text NOT NULL,
  descricao_modelo text NOT NULL,
  builtin_impl text NOT NULL,
  parametros_schema jsonb NOT NULL DEFAULT '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  smart_provider text NOT NULL DEFAULT 'none' CHECK (smart_provider IN ('none', 'mistral', 'gemini')),
  smart_model text,
  smart_prompt text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_ferramentas_custom_key_unique UNIQUE (tenant_id, ferramenta_key),
  CONSTRAINT hub_ferramentas_custom_key_format CHECK (ferramenta_key ~ '^hub_custom_[a-z0-9_]{1,48}$')
);

CREATE INDEX IF NOT EXISTS idx_hub_ferramentas_custom_tenant ON public.hub_ferramentas_custom (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_ferramentas_custom_tenant_ativo ON public.hub_ferramentas_custom (tenant_id, ativo);

COMMENT ON TABLE public.hub_ferramentas_custom IS
  'Ferramentas Mistral por tenant: nome/descrição próprios, mesma execução que um builtin; smart layer opcional (Mistral/Gemini).';
