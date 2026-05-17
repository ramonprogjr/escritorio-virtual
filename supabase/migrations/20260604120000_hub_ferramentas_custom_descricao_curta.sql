-- Descrição curta para equipa / UI (opcional). A descrição longa para o modelo permanece em descricao_modelo.

ALTER TABLE public.hub_ferramentas_custom
  ADD COLUMN IF NOT EXISTS descricao_curta text;

COMMENT ON COLUMN public.hub_ferramentas_custom.descricao_curta IS
  'Resumo legível para administradores; descricao_modelo é o texto exposto ao Mistral na function.';
