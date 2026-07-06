# 🧊 PACOTE DA JANELA — Storage (mídia) · Logs de erro · Nota Fiscal
> **Preparado 06/jul, NÃO aplicado.** É migração em prod → sua janela + revisão nossa juntos. Eu **não cravo no escuro** porque: (a) RLS/Storage eu não consigo testar daqui, e (b) o modelo de acesso (público × privado) e o de NF são **decisão sua**. Aqui está o rascunho pronto pra revisarmos e rodar.
>
> **Por que existe:** fecha o mandato do dono "TODO dado gravado em nuvem — fotos, contratos, propostas, NFs, vídeos" + log de erros. Hoje os 4 buckets são todos do lado da IA; **não há bucket de negócio**, e a foto da medição não persiste (AUT-6). A "prateleira" já existe em `lib/ia/storage.ts` (dormente).

---

## PARTE A — Buckets de mídia de NEGÓCIO

### ⚠️ DECISÃO SUA (antes de rodar): público × privado
- Os buckets atuais (`playbook-media` etc.) são **públicos** (URL estável direta).
- **Contrato / Nota Fiscal / proposta = dado sensível.** Recomendação de segurança: **PRIVADOS + URL assinada** (`createSignedUrl`, expira). Nunca `getPublicUrl` p/ esses.
- **Foto/vídeo de medição:** sua escolha. Privado é mais seguro (evidência do cliente); público é mais simples (o `SecaoHistoricoMedicoes` já renderiza `foto_url` direto). **Recomendo privado + URL assinada** (o app gera a URL no GET). Marque abaixo o que decidir.

### SQL (rascunho — mesmo padrão do projeto)
```sql
-- 5 buckets de negócio. PRIVADOS por padrão (public=false) — o app gera URL assinada.
-- Se você decidir foto/vídeo público, troque public p/ true SÓ nesses dois.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('medicoes',       'medicoes',       false, 26214400,  ARRAY['image/png','image/jpeg','image/webp','application/octet-stream']::text[]),
  ('obra-videos',    'obra-videos',    false, 209715200, ARRAY['video/mp4','video/webm','video/quicktime','application/octet-stream']::text[]),
  ('documentos-obra','documentos-obra',false, 52428800,  ARRAY['application/pdf','image/png','image/jpeg','application/octet-stream']::text[]),
  ('contratos',      'contratos',      false, 52428800,  ARRAY['application/pdf','application/octet-stream']::text[]),
  ('notas-fiscais',  'notas-fiscais',  false, 26214400,  ARRAY['application/pdf','application/xml','text/xml','application/octet-stream']::text[])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Acesso: escrita/leitura SEMPRE via SUPABASE_SERVICE_ROLE_KEY na API Next (bypassa RLS),
-- + URL assinada gerada no servidor p/ exibir. Como são privados, NÃO criamos policy public.
-- (Se algum for público, adicionar CREATE POLICY ... FOR SELECT TO public USING (bucket_id=...).)
```
> **Convenção de path (recomendo, p/ isolamento por tenant):** `<tenant_id>/<obra_id>/<arquivo>`. Assim dá pra auditar e, no futuro, aplicar RLS de storage por prefixo.

### Código que LIGA depois da janela (eu shipo gated, no-op até o bucket existir)
- `components/crm/obras/DrawerMedir.tsx` (`salvar()`): fazer upload da foto/vídeo → gravar `foto_url`/`video_url`. O backend `medicoes/route.ts` e o histórico **já aceitam** `foto_url`; falta o upload + a coluna `video_url` (ver Parte C-bis).
- Helper `urlAssinada(bucket, path)` no servidor p/ exibir privados.
- Botão "anexar documento" em obra/negócio → `hub_arquivos` (a camada `lib/ia/storage.ts` já existe; ligar ao negócio).

---

## PARTE B — Log central de ERROS (`hub_error_logs`)
> Hoje: `hub_eventos` (ações) + `hub_decision_logs` (dinheiro), mas **zero log central de erro** — erros somem em `catch{}` (CONTROLE-MESTRE §7, Onda D).

```sql
CREATE TABLE IF NOT EXISTS public.hub_error_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid,
  nivel        text NOT NULL DEFAULT 'error',      -- error | warn | fatal
  origem       text,                                -- rota/handler (ex.: 'POST /api/crm/negocios')
  mensagem     text NOT NULL,
  stack        text,
  contexto     jsonb DEFAULT '{}'::jsonb,           -- entidade/id/payload sanitizado (SEM PII crua/segredo)
  request_id   text,                                -- correlação ação↔erro↔evento
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_error_logs_criado_idx ON public.hub_error_logs (criado_em DESC);
CREATE INDEX IF NOT EXISTS hub_error_logs_tenant_idx ON public.hub_error_logs (tenant_id, criado_em DESC);
```
### Código (eu shipo): helper `registrarErro()` best-effort (nunca lança) + parar de engolir `catch{}` nas rotas críticas + painel admin de erros (fase 2).

---

## PARTE C — Nota Fiscal (⚠️ DECISÃO SUA: emitir × só anexar)
> **Não existe nada de NF hoje.** Duas visões, custo bem diferente:
> - **(recomendo p/ começar) Só ANEXAR:** você sobe o PDF/XML da NF já emitida (por fora) e o sistema guarda + liga ao pagamento/obra. Simples, resolve "tudo gravado".
> - **EMITIR:** integrar com prefeitura/SEFAZ (NFS-e/NF-e) — projeto grande, fase futura.

### SQL (rascunho — modelo "anexar"):
```sql
CREATE TABLE IF NOT EXISTS public.hub_notas_fiscais (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  obra_id       uuid,
  pagamento_id  uuid,          -- liga ao hub_obra_pagamentos (caminho do dinheiro)
  negocio_id    uuid,
  numero        text,
  emitente      text,
  valor         numeric(14,2),
  emitida_em    date,
  arquivo_path  text,          -- objeto no bucket 'notas-fiscais' (privado)
  status        text NOT NULL DEFAULT 'anexada',   -- anexada | validada | cancelada
  arquivado_em  timestamptz,   -- delete=arquiva (regra do dono)
  criado_por    uuid,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_nf_tenant_idx ON public.hub_notas_fiscais (tenant_id, criado_em DESC);
```

---

## PARTE C-bis — Medição RICA (o dono: foto/vídeo/pontos de melhoria/ficha por atividade/ambiente/fornecedor)
> Requer colunas/tabelas novas → sua janela. Rascunho mínimo (aditivo à medição existente):
```sql
ALTER TABLE public.hub_obra_medicoes
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS pontos_melhoria text,          -- RNC / o que precisa melhorar
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid;            -- quem EXECUTOU (medir por fornecedor)

-- Ficha de Verificação de Serviço (FVS) — checklist de aceite como gate de conclusão (§18 do dono)
CREATE TABLE IF NOT EXISTS public.hub_obra_fvs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  obra_id    uuid NOT NULL,
  item_id    uuid,            -- item de escopo (por atividade)
  ambiente   text,            -- por ambiente
  criterios  jsonb DEFAULT '[]'::jsonb,   -- [{criterio, ok, obs}]
  aprovado   boolean DEFAULT false,
  criado_por uuid,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
```
> **Diário de Obra (RDO):** a tabela `hub_obras_diario` já existe (lida, sem produtor). O RDO é **feature de código** (tela + POST) que eu construo — só depende da janela SE precisar de colunas novas (a conferir contra a spec `insumos-do-dono/especificacao-plataforma-gestao-obras.md §12`).

---

## ORDEM SUGERIDA quando você abrir a janela
1. Buckets (Parte A) — decidir público×privado. → destrava foto/vídeo/contrato/NF.
2. `hub_error_logs` (B) — rápido, sem decisão.
3. Medição rica (C-bis) + NF (C) — decidir modelo NF.
4. Eu ligo o código (upload de foto/vídeo, URL assinada, registrarErro, RDO) — gated, com sua verificação visual.

**Segurança correlata (já mapeada, mesma janela):** RLS `anon` ausente em tabelas novas + Faixa B tenant-null. Ver `AUDITORIA-TENANT-NULL-LEAK-05JUL.md` e `CONTROLE-MESTRE §4.1`.
