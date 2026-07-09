# 🔑 Pendências da JANELA DO DONO — fazer "de uma vez"

> Lista ÚNICA e viva de tudo que **depende de você** (config externa, migração em prod, decisão, E2E ao vivo).
> Ideia: numa janela sua a gente executa em bloco. Atualizado: **09/jul/2026**. Espelha o 00-PAINEL (seção "O que depende de VOCÊ").

Legenda: 🟢 pronto p/ aplicar (código feito, só apertar o botão) · 🟡 precisa de decisão/config sua · 🔴 destrava fase inteira

---

## 1) 🖥️ RENDER (variáveis de ambiente / config)

| Item | O que fazer | Destrava | Status |
|---|---|---|---|
| **IA_HARD_CAP** | Definir `IA_HARD_CAP=on` | Teto de crédito de IA passa a BLOQUEAR de fato (hoje é modo-sombra: mede mas não corta) | 🟢 |
| **Editor de fluxo visual** | Conferir `NEXT_PUBLIC_CRM_PLAYBOOK_FLOW_VISUAL_SIDEOVER=true` no Render novo (render.yaml já declara) | O card "Editar fluxo" (F2) abre o editor no ar | 🟢 |
| **Mistral / Copiloto** | Confirmar no Render novo: `MISTRAL_API_KEY`, `COPILOTO_HMAC_SECRET` (já postos antes — só validar após a troca de Render) | IA viva + copiloto de voz | 🟡 |
| **Health check dos envs** | Abrir `/api/health` e conferir tudo verde após qualquer troca de env | Confiança de que o deploy pegou a config | 🟢 |
| **Deploy Hook / UAZAPI** | Config do WhatsApp (UAZAPI) e Deploy Hook no Render novo — você configura | Atendimento WhatsApp | 🟡 |

---

## 2) 🗄️ SUPABASE (migrações em prod — aplicar JUNTO, via MCP, com você ciente)

| Item | O que fazer | Destrava | Status |
|---|---|---|---|
| **Registros × Logs × Permissões** | Aplicar `supabase/migrations/20260710120000_registros_categoria_imutabilidade.sql` (colunas + triggers de classificação/imutabilidade). **Smoke test na hora** (inserir 1 linha → ganha categoria, não rejeita; 0 NULL). Depois eu ligo o filtro de leitura + permissões + relatório do owner (F3-F6 do plano). | Comentários/atividades aparecem; logs ocultos+imutáveis; autor/owner editam | 🟢 (código pronto) |
| **FND-01 — baseline migration** | Schema reprodutível do zero (incorpora a linhagem aplicada à mão) | Fase 2 (obra + dinheiro real); repo reconstrói o banco | 🔴 |
| **OBR-01 / OBR-02** | Camada AEC (E0–E7/A0–A1) + RPC de medição append-only | Fase 2 (gestão de obra) | 🔴 |
| **FIN-01** | Motor de comissões em prod | Fase 2 (dinheiro da rede) | 🔴 |
| **Rotação do service_role** | Rotacionar a chave `service_role` do Supabase (é do dev demitido) | Segurança (crítico) | 🟡 |

> Regra da casa: **migração em prod = SEMPRE na sua janela**, aplicada junto via MCP, mostrando SQL + resultado, avisando antes de qualquer coisa destrutiva. Nada é destrutivo hoje (as de registros são aditivas/protetivas).

---

## 3) 🔐 SEGURANÇA / CONFIG externa (sua)

| Item | O que fazer | Destrava |
|---|---|---|
| **Rotação de segredos do dev demitido** | Rotacionar chaves/tokens que eram dele (Supabase service_role acima + o que mais existir) | Segurança |
| **HaveIBeenPwned** | Chave/integração p/ checar senha vazada no cadastro | Endurecimento de login |
| **Contas Apple / Google** | Contas das lojas (p/ apps mobile no futuro) | Fase mobile |

---

## 4) 🧭 DECISÕES do dono (destravam features — não construo sem você)

| Decisão | Por que trava | Destrava |
|---|---|---|
| **Taxonomia de "COMPRAS"** | Palavra polissêmica (produto · dentro de projeto · Tijolos · imóvel · "iFood" · etc.). NÃO construir compras sem a definição. | Módulo de compras/produtos |
| **Preços SaaS (planos)** | Sem preço não dá pra cobrar | Fase 4 (billing/MRR) |
| **Política de hold do clawback (dias)** | Quantos dias segurar antes de liberar | Fase 5 (liberação segura) |

---

## 5) ✅ E2E AO VIVO (você executa — 5 min cada)

| Teste | O que fazer | Destrava |
|---|---|---|
| **WhatsApp ponta-a-ponta** | Você manda uma mensagem no WhatsApp da Mari → IA qualifica → confirma em 1 toque | Fecha a Fase 1 (IA no ciclo do lead) |
| **Smoke test go-live Mari** | Seed do agente + `IA_GOLIVE_AT` + Mistral + webhook ON → conferir a pausa/handoff (3 formas) | Atendimento Mari 100% no ar |
| **1 pagamento real (dupla-chave)** | Validar 1 liberação pela dupla-chave (Hub + parceiro) | Prova o FIN-02 (escrow) E2E |

---

## 6) 🏁 FIM (pós-tudo — só quando zerar o resto)

| Item | O que fazer | Observação |
|---|---|---|
| **Repo de backup 12h** | Criar repo reserva no GitHub wendel-dev + rotina de backup a cada 12h | Você pediu p/ deixar por último |
| **Rotação do token UAZAPI** | Rotacionar a senha/token do UAZAPI | Você pediu: **NÃO rotacionar até o fim** |

---

**Como usar:** quando você abrir uma janela, começamos pelos 🟢 (aplico na hora com você por perto) e depois os 🟡/🔴 conforme sua decisão. Eu aplico as migrações via MCP mostrando o SQL e o resultado.
