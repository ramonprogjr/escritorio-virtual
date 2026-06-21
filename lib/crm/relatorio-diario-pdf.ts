import type { RelatorioDiarioPayload } from "@/lib/crm/relatorio-diario-aggregate";
import type { RelatorioDeployResumoItem } from "@/lib/crm/relatorio-deploy-resumo";
import type { RelatorioGitEntrega } from "@/lib/crm/relatorio-git-entregas";

type PDFDocumentCtor = new (options?: PDFKit.PDFDocumentOptions) => PDFKit.PDFDocument;

const AREA_LABELS: Record<string, string> = {
  "app/crm": "CRM",
  "app/hub": "Hub",
  "app/api": "APIs",
  "lib/crm": "Lib CRM",
  "lib/hub": "Lib Hub",
  "components/crm": "UI CRM",
  "components/hub": "UI Hub",
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
    .filter(([, n]) => n > 0)
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
      `${entrega.autor} · commit ${entrega.hashCurto} · ${entrega.arquivos.length} ficheiro(s) · ${formatAreas(entrega.areas) || "—"}`,
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

  sectionTitle(doc, "1. O que implementámos hoje");

  paragraph(doc, dev.resumo);
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .fillColor(MUTED)
    .text(
      `Fonte: ${dev.fonte === "git-live" ? "Git (repositório local)" : dev.fonte === "artefato" ? "histórico do último build" : "sem registos"}`
    );
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

  sectionTitle(doc, "2. Onde estamos no sistema");

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

    const { meta, progresso } = data;

    doc.fillColor(GOLD).fontSize(20).font("Helvetica-Bold").text("Obra10+ — Resumo de desenvolvimento", { align: "center" });
    doc.fillColor("#000000").fontSize(11).font("Helvetica").text(meta.dateLabel, { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Resumo de desenvolvimento e estado do sistema — ${meta.dateLabel}`, { align: "center" });
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
