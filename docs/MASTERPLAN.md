# 🗺️ MACROPLAN v2 — Obra10+ (o NORTE, atualizado com as implementações novas)

> Reconcilia a **sequência macro do dono** com o masterplan (7 camadas) + **tudo que o dono introduziu nesta sessão**. CEO/Chief-Architect, 29/jun. Substitui o v1 (no git). Régua no fim.

---

## 1. Onde estamos — 9 deploys no ar (auditados)
E0+A0 · E1 cockpit (ao vivo) · E2 item×subitem · E3 restrições · A1 programa+aprovações · E5 compras→estoque · A2 "Gerar Obra" · E0.5 EAP-taxonomia · **E6 financeiro+escrow+F0**.
- Método de cada bloco: **mesa redonda (4 lentes) → auditoria adversarial → correção → gates verdes (tsc + 509 testes + build) → deploy.** + agora a lente **Voz do Usuário** (simula o uso real).
- **Migrações = só-arquivo** (janela do dono); as telas degradam com aviso honesto até aplicar. O cockpit "Hoje" funciona 100% sem migração.
- **Mudou desde o v1:** +E6/E0.5 no ar; +designs E4/E7; + as implementações novas abaixo.

## 2. A sequência MACRO do dono ↔ o que já temos
> Macro do dono: **núcleo comercial PERFEITO → marketing (IA tráfego) → multi-tenant → gestão de usuários → Arquitetura & Engenharia → demais.**

| Etapa macro | Estado | Gap |
|---|---|---|
| **Núcleo comercial** (cadastros/funil/esteira/produtos/atendimento/IA) | ✅ ~90% (a "coluna" pré-sessão) | 🔧 **mobile dos cadastros (side quest)** + cross-conta CRM |
| **Marketing** (IA tráfego Google/Meta) | ⬜ futuro (não tocado) | desenhar quando o núcleo+confiança firmarem |
| **Multi-tenant** | ✅ real (`current_user_tenant_id`) + **blindado nesta sessão** (padrão tenant-NULL + F0) | go-live + cross-conta |
| **Gestão de usuários** | ✅ RBAC 5 níveis + ABAC por persona (desenhado na Plataforma) | build do ABAC cross-conta |
| **Arquitetura & Engenharia** | 🔥 **onde fomos fundo:** 9 blocos no ar + 5 superfícies + EAP-taxonomia + Orçamento IA desenhados | construir o restante |
| **Demais** | superfícies (Portal/Marketplace/Campo) + Hub + tarefas + aprovações — todos desenhados | construir |

## 3. As CAMADAS (atualizadas) — com as DUAS espinhas novas
Sobre as 7 camadas do v1 (núcleo → coluna → Eng‖Arq → financeiro/escrow → superfícies → plataforma → Hub), agora explícitas **2 espinhas operacionais** que atravessam tudo:
- **🗂️ Espinha de EXECUÇÃO = Gestor de Tarefas universal.** Todo VERBO vira tarefa; a IA controla a teia (conectadas+entregues); **humano só vê o que precisa**. Asana×Bitrix24, mas IA-orquestrado e personalizado AEC.
- **✅ Espinha de DECISÃO = Central de Aprovações.** Todo gate (medição/escrow/cliente/compra/restrição) numa fila por **mercado×atividade×tipo**; IA prioriza + auto-aprova o trivial (autonomia 1→5); humano no crítico; a decisão **ensina o agente**.
- **São irmãs:** tarefa = ação p/ execução; aprovação = ação p/ decisão. Juntas = o **sistema nervoso** sobre as 7 camadas.
- **+ implementações novas integradas:** **escrow via bancarização/BaaS** (dinheiro na instituição, Obra10 só dá o OK p/ pagar/reter); **cross-conta** (o negócio costura as contas, só o dono move, envolvido vê na cor do mercado de origem); **Orçamento IA** (memorial PDF→planilha, sobre a EAP-taxonomia); **EAP-taxonomia** (segmento→ambiente→disciplina→atividade + descritivo padrão = o vocabulário da IA).

## 4. ROADMAP em FASES (dependency-ordered, atualizado)
**FASE 1 — Núcleo usável (quase pronto):** aplicar migrações (janela) · **E4 Curva S** · fiação E3.5 · **🔧 side quest mobile cadastros** (o núcleo comercial tem que ser usável de verdade — prioridade quando a maratona pausar).
**FASE 2 — Confiança + cliente + as espinhas (o que VENDE e o que ESCALA a operação):** marketplace-preço → **Orçamento IA** → **Central de Aprovações + Gestor de Tarefas** (as 2 espinhas — viram a operação autônoma) → **Portal do Cliente** (a vitrine que cura os medos). Pré-req já feito: E6 + F0.
**FASE 3 — Campo + marketplace pleno + Hub + cross-conta:** Campo (tablet/totem/IA-campo) · marketplace logística (Lalamove) · mensageria · **cross-conta CRM** · **Hub dashboards absurdamente bons** · integração escrow/BaaS · E7 medição · E8 RDO · E9 fornecedores/SST · E10 copiloto executivo + agentes.
**Encaixe do macro original:** marketing (IA tráfego) e multi-tenant go-live entram quando o núcleo + a confiança (escrow/aprovações) estiverem sólidos — não antes (o cérebro gera o sinal que o marketing/rede precisam).

## 5. DECISÕES/PENDÊNCIAS do dono
Aplicar migrações (ordem E0→A0→E2→E3→A1→E5→E0.5→E6) · **MISTRAL_API_KEY** (acende o conversacional) · **GitHub próprio** de backup · validar preset Reforma=Consulado · **escolher o parceiro de bancarização/BaaS** (+KYC/compliance) · checkpoints de negócio (comodato condição de entrada? frete repasse vs spread? KPIs do fornecedor? spread por contrato? tipologia→tipo_obra? mesmo-usuário nas 2 chaves do escrow?) · validar a taxonomia (5/15 disciplinas hoje). Dívida técnica em `docs/DIVIDAS-TECNICAS.md`.

## 6. PRINCÍPIOS (a régua — inegociável)
Retirar **dores reais** · a tela cura os **5 medos** (atrasar/não acabar/não saber/ser enganado/perder dinheiro) · **honesto e justo, sem mentiras** (a honestidade é a arquitetura) · o **Hub é JUIZ** (escrow/BaaS + engenharia auditorial) · **NADA SE PERDE** (append-only + Hub recupera) · **asset-light** (orquestra, não possui) · **PREDITIVO** (o cérebro da obra é o moat) · **Click-and-Go / IA-first** · **a IA controla TUDO por TAREFAS** conectadas e entregues (humano só vê o que precisa) · **visão curada por papel** (anti-poluição) · **Voz do Usuário no método** (simula o uso real). **Jesus Cristo em primeiro lugar.**
