import { notFound } from "next/navigation";
import { verifyServerOwner } from "@/lib/crm/server-owner-guard";
import { ProgressoSistemaDashboard } from "@/components/crm/ProgressoSistemaDashboard";

/**
 * Server Component — guard de owner executado no servidor antes de qualquer
 * renderização do bundle client. Não-owners recebem 404 sem ver o conteúdo.
 */
export default async function ProgressoSistemaPage() {
  const isOwner = await verifyServerOwner();
  if (!isOwner) notFound();

  return <ProgressoSistemaDashboard />;
}
