-- RLS: cada usuária só enxerga e altera as próprias linhas.
-- Não há policy de DELETE em nenhuma tabela: exclusão de sessão é lógica (excluida_em).

alter table public.frentes          enable row level security;
alter table public.sessoes          enable row level security;
alter table public.pausas           enable row level security;
alter table public.correcoes        enable row level security;
alter table public.regras_contrato  enable row level security;
alter table public.fechamentos      enable row level security;

-- frentes: leitura para usuárias autenticadas; escrita só pelo painel do Supabase.
create policy frentes_select on public.frentes
  for select to authenticated
  using (true);

-- sessoes
create policy sessoes_select on public.sessoes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy sessoes_insert on public.sessoes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy sessoes_update on public.sessoes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- pausas: herdam a dona da sessão
create policy pausas_select on public.pausas
  for select to authenticated
  using (exists (
    select 1 from public.sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ));

create policy pausas_insert on public.pausas
  for insert to authenticated
  with check (exists (
    select 1 from public.sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ));

create policy pausas_update on public.pausas
  for update to authenticated
  using (exists (
    select 1 from public.sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ));

-- correcoes: só leitura e inserção (rastro imutável)
create policy correcoes_select on public.correcoes
  for select to authenticated
  using (exists (
    select 1 from public.sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ));

create policy correcoes_insert on public.correcoes
  for insert to authenticated
  with check (exists (
    select 1 from public.sessoes s
    where s.id = sessao_id and s.user_id = (select auth.uid())
  ));

-- regras_contrato
create policy regras_select on public.regras_contrato
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy regras_insert on public.regras_contrato
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy regras_update on public.regras_contrato
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- fechamentos
create policy fechamentos_select on public.fechamentos
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy fechamentos_insert on public.fechamentos
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy fechamentos_update on public.fechamentos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Visitante sem login (anon) não acessa nada.
revoke all on public.frentes, public.sessoes, public.pausas, public.correcoes,
              public.regras_contrato, public.fechamentos from anon;
