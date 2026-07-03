import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

const DATA_PATH = path.join(process.cwd(), "lib", "data", "agents-mock.json");

function readAgents(): { agents: Record<string, unknown>[] } {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeAgents(data: { agents: Record<string, unknown>[] }) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Guard de sessão: esta rota lê/grava lib/data/agents-mock.json (config de agentes).
  // Sem guard, qualquer um lia a configuração dos agentes.
  const g = await requireCrmSessao(req);
  if ("error" in g) return g.error;

  const { id } = await params;
  const data = readAgents();
  const agent = data.agents.find((a) => a.id === id);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Guard de sessão: PUT sobrescreve lib/data/agents-mock.json. Sem guard, qualquer um
  // reescrevia a configuração dos agentes no disco.
  const g = await requireCrmSessao(req);
  if ("error" in g) return g.error;

  const { id } = await params;
  const body = await req.json();
  const data = readAgents();
  const idx = data.agents.findIndex((a) => a.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  data.agents[idx] = { ...data.agents[idx], ...body, id };
  writeAgents(data);
  return NextResponse.json(data.agents[idx]);
}
