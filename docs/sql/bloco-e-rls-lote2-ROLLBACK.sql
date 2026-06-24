-- ============================================================================
-- ROLLBACK do Bloco E — LOTE 2 (~38 tabelas hub_* restantes).
-- Snapshot do banco VIVO (cdjlqsznerdhwqyunodl) 2026-06-23 antes do apply.
-- Recria EXATAMENTE as policies permissivas removidas. Nenhum dado foi apagado.
-- (Todas as quals removidas eram `true`.)
-- ============================================================================

-- ---- SELECT permissivo (anon_select: SELECT true p/ {anon,authenticated}) ----
create policy "anon_select" on public.hub_agente_identidade   for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_alertas             for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_aprovacoes          for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_atividades          for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_backups             for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_briefings           for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_caderno             for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_campanhas           for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_cargos_catalogo     for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_ciclos_ia           for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_conversas           for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_decision_logs       for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_decisoes            for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_fluxos              for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_hierarquia          for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_kpis_metas          for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_kpis_resultados     for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_log                 for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_mensagens           for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_mercados            for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_metricas_trafego    for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_negocios            for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_notas              for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_oportunidades       for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_parceiros           for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_perfis_personalidade for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_qualidade_agente    for select to anon, authenticated using (true);
create policy "anon_select" on public.hub_scripts             for select to anon, authenticated using (true);

-- ---- ALL permissivo (true p/ public) ----
create policy "hub_acesso_total"                  on public.hub_agente_conhecimento          for all to public using (true) with check (true);
create policy "hub_acesso_total"                  on public.hub_atividades                   for all to public using (true) with check (true);
create policy "hub_autonomia_matriz_service_all"  on public.hub_autonomia_matriz             for all to public using (true) with check (true);
create policy "hub_crm_briefing_msg_service_all"  on public.hub_crm_agente_briefing_mensagem for all to public using (true) with check (true);
create policy "hub_crm_briefing_sessao_service_all" on public.hub_crm_agente_briefing_sessao for all to public using (true) with check (true);
create policy "hub_acesso_total"                  on public.hub_memorias_lead                for all to public using (true) with check (true);
create policy "hub_negocio_vinculos_anon"         on public.hub_negocio_vinculos             for all to public using (true) with check (true);
create policy "hub_acesso_total"                  on public.hub_notas                        for all to public using (true) with check (true);
create policy "hub_pipeline_estagios_anon"        on public.hub_pipeline_estagios            for all to public using (true) with check (true);
create policy "hub_pipelines_anon"                on public.hub_pipelines                    for all to public using (true) with check (true);
create policy "hub_acesso_total"                  on public.hub_propostas                    for all to public using (true) with check (true);
create policy "hub_acesso_total"                  on public.hub_servicos                     for all to public using (true) with check (true);

-- ---- Remover o que o apply do lote 2 criou (todas as policies *_auth_*) ----
-- (idempotente; nomes seguem o padrão <tabela>_auth_select/_auth_insert/_auth_update)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname='public' and policyname like 'hub_%\_auth\_%' escape '\'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
