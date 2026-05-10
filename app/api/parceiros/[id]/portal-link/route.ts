import { NextRequest, NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { internalApiKeyAuthorized } from "@/lib/internal-api-auth";
import { assinarParceiroPortal } from "@/lib/parceiro-portal";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!internalApiKeyAuthorized(request) && !cronRequestAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const s = assinarParceiroPortal(id);
  const url = `${base.replace(/\/$/, "")}/parceiro/dashboard?id=${encodeURIComponent(id)}&s=${encodeURIComponent(s)}`;

  return NextResponse.json({ url });
}
