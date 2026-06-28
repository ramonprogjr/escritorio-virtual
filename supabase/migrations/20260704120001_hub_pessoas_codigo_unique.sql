-- ============================================================================
-- hub_pessoas.codigo SEM índice UNIQUE — fecha lacuna de integridade.
--
-- empresas / leads / negócios já têm UNIQUE em codigo; pessoa NÃO tinha. Se o
-- fallback COUNT(*)+1 do app rodar (rpc crm_proximo_codigo indisponível), dois
-- cadastros simultâneos geram o MESMO PES-2026-0001 e o banco aceita — duplicata
-- de código de rastreio. Este índice impede a gravação duplicada.
--
-- Escopo (tenant_id, codigo): mesmo código pode coexistir em tenants distintos
-- (o contador de código ainda é global; isolar por tenant evita falso-positivo
-- entre escritórios). Índice parcial ignora codigo NULL/vazio (legados).
--
-- IDEMPOTENTE: CREATE UNIQUE INDEX IF NOT EXISTS. NÃO APLICAR automaticamente —
-- só versionar. Aplicar só após CHECAR DUPLICATAS (query abaixo): se houver
-- linhas, resolver os códigos repetidos ANTES, senão a criação do índice falha.
-- ============================================================================

-- PASSO 1 (PRÉ-APLICAÇÃO — rodar e conferir que retorna 0 linhas):
--   SELECT tenant_id, codigo, COUNT(*) AS n
--   FROM public.hub_pessoas
--   WHERE codigo IS NOT NULL AND codigo <> ''
--   GROUP BY tenant_id, codigo
--   HAVING COUNT(*) > 1
--   ORDER BY n DESC;
-- Se retornar linhas, regularizar (regerar código das duplicatas) antes do PASSO 2.

-- PASSO 2 (criação do índice):
CREATE UNIQUE INDEX IF NOT EXISTS hub_pessoas_codigo_unique
  ON public.hub_pessoas (tenant_id, codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

COMMENT ON INDEX public.hub_pessoas_codigo_unique IS
  'Garante código PES único por tenant (rastreio ponta a ponta). Parcial: ignora codigo NULL/vazio.';

-- ROLLBACK: DROP INDEX IF EXISTS public.hub_pessoas_codigo_unique;
