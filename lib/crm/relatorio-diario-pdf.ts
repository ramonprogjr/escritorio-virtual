import type { RelatorioDiarioPayload } from "@/lib/crm/relatorio-diario-aggregate";
import type { RelatorioDeployResumoItem } from "@/lib/crm/relatorio-deploy-resumo";
import type { RelatorioGitEntrega } from "@/lib/crm/relatorio-git-entregas";

type PDFDocumentCtor = new (options?: PDFKit.PDFDocumentOptions) => PDFKit.PDFDocument;

const AREA_LABELS: Record<string, string> = {
  "app/crm": "CRM",
  "app/api": "APIs",
  "lib/crm": "Lib CRM",
  "components/crm": "UI CRM",
  "supabase/migrations": "Migrations",
  outros: "Outros",
};

async function loadPdfDocument(): Promise<PDFDocumentCtor> {
  const mod = await import("pdfkit");
  return mod.default as PDFDocumentCtor;
}

const GOLD = "#c9a24a";
const MUTED = "#666666";
const PAGE_BOTTOM = 720;

function line(doc: PDFKit.PDFDocument, y?: number) {
  const yPos = y ?? doc.y + 4;
  doc
    .moveTo(50, yPos)
    .lineTo(doc.page.width - 50, yPos)
    .strokeColor("#dddddd")
    .stroke();
  doc.moveDown(0.5);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 60) {
  if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 40);
  doc.moveDown(0.6);
  doc.fillColor(GOLD).fontSize(12).font("Helvetica-Bold").text(title);
  doc.fillColor("#000000").font("Helvetica");
  line(doc);
}

function subsection(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 30);
  doc.moveDown(0.35);
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text(title);
  doc.fillColor("#000000").font("Helvetica");
}

function paragraph(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 40);
  doc.fontSize(10).text(text, { align: "justify", lineGap: 2 });
}

function bullet(doc: PDFKit.PDFDocument, label: string, value: string | number) {
  ensureSpace(doc, 18);
  doc.fontSize(10).text(`• ${label}: `, { continued: true }).font("Helvetica-Bold").text(String(value)).font("Helvetica");
}

function listItemResumo(doc: PDFKit.PDFDocument, item: RelatorioDeployResumoItem, index: number) {
  ensureSpace(doc, 36);
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(`${index}. [${item.fase}] ${item.titulo}`, { width: doc.page.width - 100 });
  doc.font("Helvetica").fillColor(MUTED).text(item.texto, { indent: 12, width: doc.page.width - 110, lineGap: 1 });
  doc.fillColor("#000000");
  doc.moveDown(0.15);
}

function formatAreas(areas: Record<string, number>): string {
  return Object.entries(areas)
    .sort(([, a], [, b]) => b - a)
    .map(([k, n]) => `${AREA_LABELS[k] ?? k} (${n})`)
    .join(", ");
}

function renderCommit(doc: PDFKit.PDFDocument, entrega: RelatorioGitEntrega, index: number) {
  ensureSpace(doc, 48);
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(`${index}. ${entrega.hora} · ${entrega.mensagem}`, { width: doc.page.width - 100 });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text(
      `${entrega.autor} · commit ${entrega.hashCurto} · ${entrega.arquivos.length} ficheiro(s) · ${formatAreas(entrega.areas)}`,
      { indent: 12, width: doc.page.width - 110 }
    );
  const filesPreview = entrega.arquivos.slice(0, 8);
  if (filesPreview.length > 0) {
    doc.text(filesPreview.join(", "), { indent: 12, width: doc.page.width - 110, lineGap: 1 });
    if (entrega.arquivos.length > 8) {
      doc.text(`… +${entrega.arquivos.length - 8} ficheiros`, { indent: 12 });
    }
  }
  doc.fillColor("#000000");
  doc.moveDown(0.2);
}

function renderDesenvolvimento(doc: PDFKit.PDFDocument, data: RelatorioDiarioPayload) {
  const dev = data.desenvolvimento;

  sectionTitle(doc, "1. Trabalho técnico do dia — o que desenvolvi");

  paragraph(doc, data.desenvolvimento.resumo);
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .fillColor(MUTED)
    .text(`Fonte: ${dev.fonte === "git-live" ? "Git (repositório local)" : dev.fonte === "artefato" ? "histórico do último build" : "sem registos"}`);
  doc.fillColor("#000000");

  if (dev.entregas.length === 0) {
    doc.moveDown(0.3);
    paragraph(
      doc,
      "Nenhum commit Git nesta data. Se trabalhou sem commit, faça push antes do relatório ou escolha outro dia."
    );
  } else {
    doc.moveDown(0.3);
    dev.entregas.forEach((e, i) => renderCommit(doc, e, i + 1));
  }

  if (dev.entregasRelacionadas.length > 0) {
    subsection(doc, "Ligado ao plano Obra10+");
    doc.fontSize(9).fillColor(MUTED).text("Funcionalidades da matriz Progresso tocadas por estes commits:");
    doc.fillColor("#000000");
    for (const rel of dev.entregasRelacionadas) {
      ensureSpace(doc, 20);
      doc.fontSize(9).text(`• ${rel.titulo}`, { indent: 8, width: doc.page.width - 100 });
    }
  }
}

function renderEstadoSistema(doc: PDFKit.PDFDocument, progresso: RelatorioDiarioPayload["progresso"]) {
  const rd = progresso.resumoDeploy;

  sectionTitle(doc, "2. Estado do sistema (resumo)");

  paragraph(doc, rd.intro);
  doc.moveDown(0.2);
  paragraph(doc, rd.situacaoGeral);

  if (rd.emAndamento.length > 0) {
    subsection(doc, "Em andamento");
    rd.emAndamento.forEach((item, i) => listItemResumo(doc, item, i + 1));
  }

  if (rd.proximasPrioridades.length > 0) {
    subsection(doc, "Próximas prioridades");
    rd.proximasPrioridades.forEach((item, i) => listItemResumo(doc, item, i + 1));
  }

  subsection(doc, "Checklist deploy");
  for (const c of rd.checklistDeploy) {
    ensureSpace(doc, 14);
    const icon = c.ok ? "OK" : "Pend.";
    doc.fontSize(9).text(`[${icon}] ${c.label}`, { indent: 8, width: doc.page.width - 100 });
  }
}

export async function buildRelatorioDiarioPdf(data: RelatorioDiarioPayload): Promise<Buffer> {
  const PDFDocument = await loadPdfDocument();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { meta, operacao, equipa, progresso } = data;

    doc.fillColor(GOLD).fontSize(20).font("Helvetica-Bold").text("Obra10+ — Relatório do dia", { align: "center" });
    doc.fillColor("#000000").fontSize(11).font("Helvetica").text(meta.dateLabel, { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `Este relatório mostra o que foi desenvolvido em ${meta.dateLabel} e o estado actual do CRM.`,
        { align: "center" }
      );
    doc
      .fontSize(9)
      .text(
        `Empresa: ${meta.tenant.nome ?? meta.tenant.id} · Gerado por: ${meta.geradoPor.name ?? meta.geradoPor.email ?? "—"} · ${new Date(meta.generatedAt).toLocaleString("pt-BR")}`,
        { align: "center" }
      );
    doc.text(meta.appUrl, { align: "center", link: meta.appUrl, underline: true });
    doc.fillColor("#000000");

    renderDesenvolvimento(doc, data);
    renderEstadoSistema(doc, progresso);

    sectionTitle(doc, "3. Operação CRM (dia selecionado)");
    bullet(doc, "Leads novos", operacao.leadsNovos);
    bullet(doc, "Qualificados (atualizados no dia)", operacao.leadsQualificadosDia);
    bullet(doc, "Taxa qualificação", `${operacao.taxaQualificacao}%`);
    bullet(doc, "Encaminhamentos", operacao.encaminhamentos);
    bullet(doc, "Negócios criados", operacao.negociosCriados);
    bullet(doc, "Negócios fechados", operacao.negociosFechados);
    bullet(doc, "Mensagens entrada", operacao.mensagensEntrada);
    bullet(doc, "Mensagens saída", operacao.mensagensSaida);
    bullet(doc, "Leads aguardando resposta", operacao.metricas.leadsAguardando);
    bullet(doc, "Aprovações pendentes", operacao.aprovacoesPendentes);
    bullet(doc, "Fila mensagens pendente", operacao.metricas.mensagensFilaPendentes);
    bullet(doc, "Alertas abertos", operacao.alertasAbertos);
    bullet(doc, "Receita potencial pipeline", `R$ ${operacao.metricas.receitaPotencial.toLocaleString("pt-BR")}`);

    sectionTitle(doc, "4. Equipa");
    bullet(doc, "Utilizadores ativos", equipa.usuariosAtivos);
    bullet(doc, "Convites / novos no dia", equipa.convitesDia);
    doc.moveDown(0.3);
    doc.fontSize(10).text("Por permissão:");
    for (const [role, count] of Object.entries(equipa.porPermissao).sort(([a], [b]) => a.localeCompare(b))) {
      doc.text(`  — ${role}: ${count}`, { indent: 8 });
    }

    doc.moveDown(1.5);
    ensureSpace(doc, 30);
    line(doc);
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `Obra10+ · Confidencial · Matriz ${progresso.resumoDeploy.revisaoMatriz} · Progresso Sistema`,
        { align: "center" }
      );

    doc.end();
  });
}
