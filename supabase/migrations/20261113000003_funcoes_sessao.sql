-- Funções de iniciar / pausar / retomar / encerrar sessão.
-- security invoker: rodam com as permissões de quem chama, então o RLS vale.
-- O horário vem sempre do banco (now()), não do aparelho.

create function public.iniciar_sessao()
returns public.sessoes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sessao public.sessoes;
begin
  if auth.uid() is null then
    raise exception 'Faça login para iniciar uma sessão.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.sessoes
    where user_id = auth.uid() and fim is null and excluida_em is null
  ) then
    raise exception 'Já existe uma sessão em andamento.' using errcode = 'P0001';
  end if;

  insert into public.sessoes (user_id, inicio)
  values (auth.uid(), now())
  returning * into v_sessao;

  return v_sessao;
end;
$$;

create function public.pausar_sessao(p_sessao uuid)
returns public.pausas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pausa public.pausas;
begin
  perform 1 from public.sessoes
  where id = p_sessao and fim is null and excluida_em is null
  for update;
  if not found then
    raise exception 'Sessão não encontrada ou já encerrada.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.pausas where sessao_id = p_sessao and fim is null) then
    raise exception 'A sessão já está pausada.' using errcode = 'P0001';
  end if;

  insert into public.pausas (sessao_id, inicio)
  values (p_sessao, now())
  returning * into v_pausa;

  return v_pausa;
end;
$$;

create function public.retomar_sessao(p_sessao uuid)
returns public.pausas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pausa public.pausas;
begin
  perform 1 from public.sessoes
  where id = p_sessao and fim is null and excluida_em is null
  for update;
  if not found then
    raise exception 'Sessão não encontrada ou já encerrada.' using errcode = 'P0001';
  end if;

  update public.pausas
  set fim = now()
  where sessao_id = p_sessao and fim is null
  returning * into v_pausa;

  if v_pausa.id is null then
    raise exception 'A sessão não está pausada.' using errcode = 'P0001';
  end if;

  return v_pausa;
end;
$$;

create function public.encerrar_sessao(
  p_sessao     uuid,
  p_frente     bigint,
  p_local      public.local_sessao,
  p_observacao text default null
)
returns public.sessoes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sessao public.sessoes;
  v_obs    text := nullif(trim(p_observacao), '');
begin
  perform 1 from public.sessoes
  where id = p_sessao and fim is null and excluida_em is null
  for update;
  if not found then
    raise exception 'Sessão não encontrada ou já encerrada.' using errcode = 'P0001';
  end if;

  if p_local is null then
    raise exception 'Escolha o local da sessão.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.frentes where id = p_frente and ativa) then
    raise exception 'Escolha uma frente ativa.' using errcode = 'P0001';
  end if;

  if v_obs is not null and length(v_obs) > 1000 then
    raise exception 'A observação pode ter no máximo 1000 caracteres.' using errcode = 'P0001';
  end if;

  -- Fecha a pausa aberta, se houver, no mesmo instante do encerramento.
  update public.pausas
  set fim = now()
  where sessao_id = p_sessao and fim is null;

  update public.sessoes
  set fim = now(),
      frente_id = p_frente,
      local = p_local,
      observacao = v_obs
  where id = p_sessao
  returning * into v_sessao;

  return v_sessao;
end;
$$;

revoke execute on function public.iniciar_sessao() from public, anon;
revoke execute on function public.pausar_sessao(uuid) from public, anon;
revoke execute on function public.retomar_sessao(uuid) from public, anon;
revoke execute on function public.encerrar_sessao(uuid, bigint, public.local_sessao, text) from public, anon;

grant execute on function public.iniciar_sessao() to authenticated;
grant execute on function public.pausar_sessao(uuid) to authenticated;
grant execute on function public.retomar_sessao(uuid) to authenticated;
grant execute on function public.encerrar_sessao(uuid, bigint, public.local_sessao, text) to authenticated;
