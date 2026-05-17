-- Coluna usada pelo CRM/API para notas administrativas (alinhamento com POST/PATCH e drawer).

ALTER TABLE public.hub_ferramentas_custom
  ADD COLUMN IF NOT EXISTS descricao_curta text;

COMMENT ON COLUMN public.hub_ferramentas_custom.descricao_curta IS
  'Descrição curta visível no CRM (admin); distinta da descrição exposta ao modelo (descricao_modelo).';
