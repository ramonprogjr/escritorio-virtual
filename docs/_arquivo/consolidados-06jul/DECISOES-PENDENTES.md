# 🔑 DECISÕES PENDENTES DO DONO

> Tudo que depende de você para o projeto avançar. Ordenado por urgência. Impacto real, não burocracia.

## 🚨 Infra / produção (fazer numa JANELA CONCENTRADA — é o caminho crítico)

| Decisão / Ação | Por que precisa de você | Impacto se atrasar | Prazo | Recomendação |
|---|---|---|---|---|
| **Rotate `SUPABASE_SERVICE_ROLE_KEY`** | acesso ao Supabase; é a chave-mestra (válida até 2036) | vazamento ATIVO de credencial | **hoje** | rotacionar + guardar em secret files |
| **Deletar `.github/workflows/backup-auto.yml`** | é seu repo/CI | ele faz `git push` de PII de leads pro histórico do Git (LGPD) | **hoje** | deletar + limpar histórico se possível |
| **Tirar repo/`.env.local` do OneDrive** | é sua máquina | credencial sincronizada na nuvem pessoal | **hoje** | mover pra pasta local fora do OneDrive |
| **Setar `MISTRAL_API_KEY` + `COPILOTO_HMAC_SECRET`** | billing Mistral ativo | **a IA não responde — trava o nº1 do MVP há 60 dias** | dias | ligar Mistral (ou Groq grátis como fallback) |
| **Aplicar as ~19 migrações** (janela guiada comigo) | acesso ao Supabase + é produção | a camada AEC pronta fica dormente | 1 sessão | seguir docs/PLANO-APLICAR-MIGRACOES.md; revisar juntos `merge_pessoas` (mexe em dado) |
| **Tirar `NEXT_PUBLIC_INTERNAL_API_KEY`/`NEXT_PUBLIC_TENANT_ID` do Render** + testar login | acesso ao Render | chave interna no bundle | dias | remover + validar login |
| **Setar `CRON_SECRET`** | acesso ao Render | cron forjável | dias | segredo forte |
| **Ligar o middleware** (comigo, verificando a allowlist) | é auth app-wide de produção | ~60 rotas abertas | 1 sessão | testar login + intake público juntos antes |

## 💼 Decisões de negócio (sua palavra define o código)

| Decisão | Por que | Impacto | Recomendação |
|---|---|---|---|
| **Escrow: 2 chaves = papéis distintos?** (Arq×Hub) | regra do dinheiro | hoje é "2 cliques"; F-D2 já força owner×gestor | confirmar se quer papel "arquiteto" dedicado |
| **`MOTOR_FONTE=fornecedores`?** | migra o motor de leads p/ a entidade consolidada | validado lado-a-lado | ligar quando confortável |
| **Markup dos créditos de IA** (por escritório ou mercado) | precificação | define a 3ª perna de receita | definir a régua |
| **Planos SaaS** (nomes, preços, módulos por plano) | entitlements não existem | é o que torna vendável (V1) | rascunhar 2-3 planos |
| **Captação pública** (`/api/parceiros`, `/api/leads` intake) | define o que fica sem sessão | segurança × conversão | confirmar quais formulários são públicos |
| **`/crm/conteudo` stub, `/api/health`** | produto | pequenos | já recomendei (esconder / owner-only) |

## 🧪 Validação ao vivo (comigo, em prod)
- **3 testes de IA** (dependem da Mistral ligada): (1) "Gerar fluxo com IA" no editor, (2) atendimento WhatsApp respondendo, (3) copiloto de voz.
- **Review visual mobile** (o que sobrou: scroll dos kanbans, funil vertical).

## 🗂️ Organização (você pediu)
- **GitHub próprio de backup** (o dev foi demitido mas o repo é dele — risco de bloqueio): finalizar o push pro repo backup.
- Docs de diagnóstico agora concentrados em `docs/` (este conjunto) — ponto único de retorno.
