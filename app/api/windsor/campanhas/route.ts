import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) return NextResponse.json([]);

  try {
    const hoje = new Date();
    const seteDias = new Date(hoje.getTime() - 7 * 24 * 3600000);
    const dateFrom = seteDias.toISOString().split("T")[0];
    const dateTo = hoje.toISOString().split("T")[0];

    const res = await fetch(
      `https://connectors.windsor.ai/facebook?api_key=${apiKey}&date_from=${dateFrom}&date_to=${dateTo}&fields=campaign,spend,clicks,impressions,cpc,ctr`,
      { next: { revalidate: 21600 } }
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    return NextResponse.json(data?.data || []);
  } catch {
    return NextResponse.json([]);
  }
}
