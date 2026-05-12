-- Matriz de autonomia configurável (complementa hub_hierarquia.limite_autonomia_brl e criterios_escalonamento).
-- Referência: hub_agente_identidade.agente_slug (UNIQUE) — alinhado ao schema em contexto.
-- Ordem de avaliação no código: regras da matriz (prioridade DESC) → depois fallback hub_hierarquia.

CREATE TABLE IF NOT EXISTS public.hub_autonomia_matriz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_slug text NOT NULL REFERENCES public.hub_agente_identidade(agente_slug) ON UPDATE CASCADE ON DELETE CASCADE,
  canal text CHECK (
    canal IS NULL
    OR canal = '*'
    OR canal = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'email'::text, 'interno'::text, 'site'::text])
  ),
  nome text NOT NULL,
  prioridade integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  exige_aprovacao boolean NOT NULL DEFAULT false,
  limite_autonomia_brl numeric,
  palavras_chave text[] NOT NULL DEFAULT '{}'::text[],
  regex_opcional text,
  observacao text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_autonomia_matriz_agente_canal
  ON public.hub_autonomia_matriz(agente_slug, ativo)
  WHERE ativo = true;

COMMENT ON TABLE public.hub_autonomia_matriz IS
  'Regras por agente/canal: gatilhos na mensagem + limite BRL ou exige_aprovacao. canal NULL ou * = todos.';

ALTER TABLE public.hub_autonomia_matriz ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_autonomia_matriz_service_all ON public.hub_autonomia_matriz;
CREATE POLICY hub_autonomia_matriz_service_all ON public.hub_autonomia_matriz
  FOR ALL USING (true) WITH CHECK (true);
