import { NextRequest, NextResponse } from "next/server";
import {
  aggregateRelatorioDiario,
  parseRelatorioDate,
} from "@/lib/crm/relatorio-diario-aggregate";
import {
  crmApiConfigError,
  requireCrmOwner,
  requireInternalApiKey,
} from "@/lib/crm/crm-api-auth";
import { crmDb } from "@/lib/crm/supabase-server";

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const owner = await requireCrmOwner(request);
  if ("error" in owner) return owner.error;

  const date = parseRelatorioDate(request.nextUrl.searchParams.get("date"));
  const format = request.nextUrl.searchParams.get("format")?.trim().toLowerCase() ?? "json";

  try {
    const payload = await aggregateRelatorioDiario(crmDb(), {
      tenantId: owner.ctx.tenantId,
      userId: owner.ctx.userId,
      date,
    });

    if (format === "pdf") {
      const { buildRelatorioDiarioPdf } = await import("@/lib/crm/relatorio-diario-pdf");
      const pdf = await buildRelatorioDiarioPdf(payload);
      const filename = `obra10-relatorio-${date}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar relatório.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
