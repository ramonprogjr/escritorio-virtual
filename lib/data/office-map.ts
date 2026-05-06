// Coordenadas calibradas diretamente pelo office-map.json (1672×941 px)
// Fórmula: x% = navigationPoint.x / 1672 * 100, y% = navigationPoint.y / 941 * 100
// O container usa aspectRatio "1672/941" então os % batem pixel-perfect com a imagem.

export const MAPA_AGENTES: Record<string, { sala: string; x: number; y: number }> = {
  // N1 — CEO  (ceo_office nav 210,150)
  ceo:                     { sala: "CEO",                       x: 12.6, y: 15.9 },
  // N2 — Diretores
  ariane:                  { sala: "Dir. Marketing",            x: 26.0, y: 15.9 },  // marketing_director nav 435,150
  diretor_comercial:       { sala: "Dir. Comercial",            x: 38.9, y: 15.9 },  // commercial_director nav 650,150
  closer:                  { sala: "Sala Reunião 1",            x: 51.7, y: 15.9 },  // meeting_room_01 nav 865,150
  diretor_operacoes:       { sala: "Sala Reunião 2",            x: 65.2, y: 15.9 },  // meeting_room_02 nav 1090,150
  cs:                      { sala: "Sala Reunião 2",            x: 67.2, y: 15.9 },  // meeting_room_02 offset +2x
  dev_ia:                  { sala: "Operações",                 x: 80.5, y: 15.9 },  // área ops top-right
  monitor_qualidade:       { sala: "Operações",                 x: 87.0, y: 15.9 },  // área ops top-right
  // N3 — Gestores (row 2, y nav=340 → 36.1%)
  gestor_projetos:         { sala: "Estratégia",                x: 12.6, y: 36.1 },  // strategy_planning nav 210,340
  crm_ia:                  { sala: "Estratégia",                x: 10.6, y: 36.1 },  // strategy_planning offset -2x
  estrategista:            { sala: "Estratégia",                x: 14.6, y: 36.1 },  // strategy_planning offset +2x
  pesquisador:             { sala: "Estratégia",                x: 12.6, y: 38.1 },  // strategy_planning offset +2y
  gestor_conteudo:         { sala: "Copy Lab",                  x: 24.8, y: 36.1 },  // copy_lab nav 415,340
  copywriter:              { sala: "Copy Lab",                  x: 26.8, y: 36.1 },  // copy_lab offset +2x
  designer:                { sala: "Design Studio",             x: 35.3, y: 36.1 },  // design_studio nav 590,340
  motion_designer:         { sala: "Design Studio",             x: 37.3, y: 36.1 },  // design_studio offset +2x
  gestor_trafego:          { sala: "Performance & Tráfego",     x: 49.6, y: 36.1 },  // performance_traffic nav 830,340
  analista_trafego_google: { sala: "Performance & Tráfego",     x: 47.6, y: 36.1 },  // performance_traffic offset -2x
  analista_trafego_meta:   { sala: "Performance & Tráfego",     x: 51.6, y: 36.1 },  // performance_traffic offset +2x
  analytics_ia:            { sala: "Performance & Tráfego",     x: 49.6, y: 38.1 },  // performance_traffic offset +2y
  gerente_vendas:          { sala: "Ger. Vendas",               x: 64.6, y: 36.1 },  // sales_manager nav 1080,340
  // N3 — Gerentes Atendimento (row 3, y nav=525 → 55.8%)
  revisor_ia:              { sala: "Conteúdo & Mídia",          x: 29.9, y: 55.8 },  // content_media nav 500,525
  social_media:            { sala: "Conteúdo & Mídia",          x: 31.9, y: 55.8 },  // content_media offset +2x
  // N4 — Atendimento (row 4, y nav=720 → 76.5%)
  sdr:                     { sala: "Lead Qualification Zone",   x: 16.7, y: 76.5 },  // lead_qual_zone nav 280,720
  gerente_atendimento:     { sala: "Atendimento Ativo",          x: 58.0, y: 76.5 },  // active_attendance nav 970,720
  atendente:               { sala: "Atendimento Ativo",          x: 60.0, y: 76.5 },  // active_attendance offset +2x
};

export const CORES_AREA: Record<string, string> = {
  Diretoria:  "#c9a24a",
  Marketing:  "#8b5cf6",
  Conteúdo:   "#10b981",
  Tráfego:    "#3b82f6",
  Comercial:  "#ef4444",
  Vendas:     "#ef4444",
  Atendimento:"#f97316",
  Operações:  "#6b7280",
  Estratégia: "#f59e0b",
  Gestão:     "#06b6d4",
};

export const TAMANHO_NIVEL: Record<number, number> = {
  1: 36,
  2: 32,
  3: 28,
  4: 24,
  5: 22,
};

export function getInitials(cargo: string): string {
  const skip = new Set(["de", "do", "da", "dos", "das", "e", "IA", "ao"]);
  const words = cargo.split(" ").filter(w => w.length > 1 && !skip.has(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return cargo.slice(0, 2).toUpperCase();
}
