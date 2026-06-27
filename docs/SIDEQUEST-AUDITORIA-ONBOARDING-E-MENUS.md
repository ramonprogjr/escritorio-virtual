# 🧭 Side quest — Auditoria do Onboarding (Área de Membros) + redesenho dos menus do app

> Pedido do dono: o app Obra10+ mobile tem barra inferior com **"Pulso" inútil** e um botão de menu que abre uma **lista feia, sem hierarquia ("linhas de planilha")**; **desktop e mobile são dois sistemas diferentes**. O sistema de **onboarding** (Área de Membros, `obra10-membros.vercel.app`) tem um **menu sanduíche bonito** e identidade forte — usar como referência pra melhorar **cores, visual e menus** do app principal.

## 1. O que é o Onboarding (Área de Membros)
Plataforma do **lado Hub**: homologação + onboarding + comunidade + academy. Telas auditadas (logado como OWNER): Login · Painel da Operação · Funil de Homologação · Parceiros · Mão de obra · Documentos·Análise · Comunidade·Feed · Suporte · Conteúdo & Trilhas (academy) · Configurações; toggle **Membro/Admin**; versão **mobile + sanduíche**.

**Regra de acesso (o elo com o nosso CRM):** cadastro → **Aprovado** → **Liberado p/ CRM** = o membro ganha acesso ao sistema que construímos. O membro cria conta pelo link de convite com o **MESMO e-mail** e o sistema **vincula sozinho**. (Base de cadastros deve ser a mesma — integração mais profunda fica pra depois.)

## 2. Por que o onboarding é bonito (o que copiar)
- **Identidade da marca:** fundo **verde escuro** + acentos **dourado/verde**. (O app principal usa cinza-GitHub `#0d1117`/azulado — genérico.)
- **Um único menu, consistente desktop↔mobile:** sidebar **em seções** ("GESTÃO DO HUB", "VISÃO") com ícone+label, **badges de contagem** (Funil 1, Documentos 6), **item ativo destacado em verde**. No mobile é **o mesmo sidebar** deslizando via **sanduíche** — **sem barra inferior**.
- **Hierarquia forte:** títulos grandes, subtítulo de contexto, **cards de ação** ("O que precisa de você agora"), **KPIs em cards**, **chips de filtro/aba** (verde quando ativo).
- **Listas emolduradas, não planilha:** card de ação no topo + busca + chips + tabela com **status em pílula** (Pendente âmbar / Aprovado verde) e **ações por linha** (Painel · Editar · Liberar p/ CRM). Conteúdo (academy) em **cards ricos com capa**.

## 3. Diagnóstico do app principal (causa no código)
Arquivo `lib/mobile/nav.ts`:
- **"Pulso" é redundante:** `{ id: "pulso", rota: "/crm" }` e `{ id: "escritorio" (CRM), rota: "/crm" }` apontam **ambos pro `/crm`**. Pulso é um clone do CRM → "não serve a nada".
- **A "lista feia" = aba "Mais":** `MOBILE_MORE_ITEMS` é uma **lista plana de 12 links** sem seções nem hierarquia.
- **Dois sistemas:** mobile = **barra inferior (`MOBILE_TABS`) + folha "Mais"** (`components/mobile/MobileShell.tsx`); desktop = **sidebar em seções** (`lib/crm-nav-groups.ts` `CRM_NAV_GROUPS`, render em `app/crm/layout.tsx`). São dois modelos de navegação paralelos.
- **Identidade:** chrome do app em `#0d1117` (GitHub-dark) — fora da marca verde+dourado do onboarding.

## 4. Proposta (alinhar o app ao onboarding)
**A. Menu (a dor nº1) — unificar mobile ao desktop:**
1. **Matar a barra inferior + "Pulso".**
2. Mobile passa a usar **sanduíche → drawer em SEÇÕES** reaproveitando `CRM_NAV_GROUPS` (o `app/crm/layout.tsx` **já tem** um drawer mobile com os grupos — hoje fica "atrás" da barra inferior do `MobileShell`). Resultado: **um só menu** desktop↔mobile, igual ao onboarding (ícone+label, badges, seção, ativo em verde).
   - *Quick win alternativo (menor):* manter a barra inferior mas **trocar a folha "Mais"** plana pelo drawer **em seções** + **remover o "Pulso"** (fundir com CRM). Menos disruptivo, resolve 80%.

**B. Identidade/cores:** migrar o chrome do app do cinza-GitHub para o **dark verde + dourado** do onboarding (tokens `--brand-*` já existem em `globals.css`). Consistência visual entre os dois sistemas.

**C. Listas:** emoldurar tabelas como o onboarding (card de ação + chips de filtro + **status em pílula** + ações por linha) — casa com o mandato "tabela ≠ tela de trabalho".

## 5. Recomendação de execução
Começar por **A (menu)** — é a dor nº1 e a maior inconsistência. Decisão do dono: **quick win** (tirar Pulso + folha "Mais" vira drawer em seções) ou **unificação completa** (mobile usa o drawer do CrmLayout, aposenta a barra inferior). Depois **B (cores)** e **C (listas)** incrementais. Tudo aditivo, com gate e verificável clicando.

*(Auditoria via Chrome do dono em 26/jun. Não foi alterado nada no sistema de onboarding.)*
