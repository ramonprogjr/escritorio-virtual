// Coordenadas calibradas para office-mobile-bg.png (863×1822 px)
// Fórmula: x% = xPx / 863 * 100 · y% = yPx / 1822 * 100
// Layout vertical: executivos no topo → gestores no meio → atendimento na base.
// Usar aspectRatio "863/1822" no container para batem pixel-perfect.

export const MAPA_AGENTES_MOBILE: Record<string, { sala: string; x: number; y: number }> = {
  // ── N1 — CEO ────────────────────────────────────────── y≈6% (px≈110)
  ceo:                     { sala: "CEO",                       x: 20.0, y:  6.0 },

  // ── N2 — Diretores ──────────────────────────────────── y≈6-13% (px≈110-237)
  ariane:                  { sala: "Dir. Marketing",            x: 50.0, y:  6.0 },
  diretor_comercial:       { sala: "Dir. Comercial",            x: 78.0, y:  6.0 },
  closer:                  { sala: "Sala Reunião",              x: 20.0, y: 13.0 },
  diretor_operacoes:       { sala: "Operações",                 x: 50.0, y: 13.0 },
  cs:                      { sala: "CS",                        x: 78.0, y: 13.0 },
  dev_ia:                  { sala: "Dev IA",                    x: 78.0, y: 22.0 },
  monitor_qualidade:       { sala: "Qualidade",                 x: 78.0, y: 31.0 },

  // ── N3 — Estratégia ─────────────────────────────────── y≈22-31%
  gestor_projetos:         { sala: "Estratégia",                x: 20.0, y: 22.0 },
  crm_ia:                  { sala: "Estratégia",                x: 20.0, y: 31.0 },
  estrategista:            { sala: "Estratégia",                x: 50.0, y: 22.0 },
  pesquisador:             { sala: "Estratégia",                x: 50.0, y: 31.0 },

  // ── N3 — Conteúdo & Copy ────────────────────────────── y≈40-49%
  gestor_conteudo:         { sala: "Copy Lab",                  x: 20.0, y: 40.0 },
  copywriter:              { sala: "Copy Lab",                  x: 50.0, y: 40.0 },
  revisor_ia:              { sala: "Conteúdo & Mídia",          x: 20.0, y: 49.0 },
  social_media:            { sala: "Conteúdo & Mídia",          x: 50.0, y: 49.0 },

  // ── N3 — Design ─────────────────────────────────────── y≈40-49%
  designer:                { sala: "Design Studio",             x: 78.0, y: 40.0 },
  motion_designer:         { sala: "Design Studio",             x: 78.0, y: 49.0 },

  // ── N3 — Performance & Tráfego ──────────────────────── y≈58-67%
  gestor_trafego:          { sala: "Performance",               x: 20.0, y: 58.0 },
  analista_trafego_google: { sala: "Performance",               x: 50.0, y: 58.0 },
  analista_trafego_meta:   { sala: "Performance",               x: 20.0, y: 67.0 },
  analytics_ia:            { sala: "Performance",               x: 50.0, y: 67.0 },

  // ── N3 — Vendas ─────────────────────────────────────── y≈58%
  gerente_vendas:          { sala: "Ger. Vendas",               x: 78.0, y: 58.0 },

  // ── N4 — Atendimento Ativo ──────────────────────────── y≈76%
  sdr:                     { sala: "Qualificação",              x: 20.0, y: 76.0 },
  gerente_atendimento:     { sala: "Atendimento",               x: 50.0, y: 76.0 },
  atendente:               { sala: "Atendimento",               x: 78.0, y: 76.0 },
};
