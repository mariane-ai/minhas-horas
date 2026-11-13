-- Registro de Horas — esquema base (etapa 1)
-- Todas as datas/horas em timestamptz; exibição no fuso America/Sao_Paulo.

create type public.local_sessao as enum ('girassol', 'externo');

-- ---------------------------------------------------------------------------
-- frentes: tipos de trabalho; lista compartilhada, sem dado pessoal
-- ---------------------------------------------------------------------------
create table public.frentes (
  id     bigint generated always as identity primary key,
  nome   text    not null unique check (length(trim(nome)) > 0),
  ativa  boolean not null default true,
  ordem  integer not null default 0
);

-- ---------------------------------------------------------------------------
-- sessoes: uma sessão de prestação de serviço
-- frente_id e local ficam nulos enquanto a sessão está aberta (fim nulo).
-- ---------------------------------------------------------------------------
create table public.sessoes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  inicio         timestamptz not null default now(),
  fim            timestamptz,
  frente_id      bigint references public.frentes (id),
  local          public.local_sessao,
  observacao     text check (observacao is null or length(observacao) <= 1000),
  lancada_depois boolean not null default false,
  excluida_em    timestamptz,
  criada_em      timestamptz not null default now(),
  constraint sessoes_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint sessoes_encerrada_completa check (
    fim is null or (frente_id is not null and local is not null)
  )
);

-- No máximo uma sessão aberta por usuária.
create unique index sessoes_uma_aberta_por_usuaria
  on public.sessoes (user_id)
  where fim is null and excluida_em is null;

create index sessoes_user_inicio on public.sessoes (user_id, inicio);

-- ---------------------------------------------------------------------------
-- pausas: intervalos descontados das horas prestadas da sessão
-- ---------------------------------------------------------------------------
create table public.pausas (
  id        uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.sessoes (id) on delete cascade,
  inicio    timestamptz not null default now(),
  fim       timestamptz,
  constraint pausas_fim_depois_do_inicio check (fim is null or fim >= inicio)
);

-- No máximo uma pausa aberta por sessão.
create unique index pausas_uma_aberta_por_sessao
  on public.pausas (sessao_id)
  where fim is null;

create index pausas_sessao on public.pausas (sessao_id);

-- ---------------------------------------------------------------------------
-- correcoes: rastro de toda edição (somente inserção; ver RLS)
-- ---------------------------------------------------------------------------
create table public.correcoes (
  id            uuid primary key default gen_random_uuid(),
  sessao_id     uuid not null references public.sessoes (id) on delete cascade,
  campo         text not null,
  valor_antigo  text,
  valor_novo    text,
  motivo        text not null check (length(trim(motivo)) > 0),
  corrigida_em  timestamptz not null default now()
);

create index correcoes_sessao on public.correcoes (sessao_id);

-- ---------------------------------------------------------------------------
-- regras_contrato: carga de referência e valor por vigência
-- vigencia_fim é inclusiva; nula = vigente sem data de término.
-- valor_mensal e limite_alerta_h são opcionais (preenchidos no painel do Supabase).
-- ---------------------------------------------------------------------------
create table public.regras_contrato (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  carga_semanal_h  numeric(5, 2) not null check (carga_semanal_h > 0),
  valor_mensal     numeric(12, 2) check (valor_mensal is null or valor_mensal >= 0),
  limite_alerta_h  numeric(5, 2) check (limite_alerta_h is null or limite_alerta_h > 0),
  vigencia_inicio  date not null,
  vigencia_fim     date,
  constraint regras_vigencia_valida check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create index regras_contrato_user_vigencia on public.regras_contrato (user_id, vigencia_inicio);

-- Impede vigências sobrepostas para a mesma usuária.
create function public.regras_contrato_sem_sobreposicao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.regras_contrato r
    where r.user_id = new.user_id
      and r.id <> new.id
      and daterange(r.vigencia_inicio, r.vigencia_fim, '[]')
          && daterange(new.vigencia_inicio, new.vigencia_fim, '[]')
  ) then
    raise exception 'A vigência informada se sobrepõe a outra regra de contrato.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger regras_contrato_sem_sobreposicao
  before insert or update on public.regras_contrato
  for each row execute function public.regras_contrato_sem_sobreposicao();

-- ---------------------------------------------------------------------------
-- fechamentos: consolidação mensal (usada na etapa 4)
-- mes = primeiro dia do mês.
-- ---------------------------------------------------------------------------
create table public.fechamentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mes          date not null check (extract(day from mes) = 1),
  total_h      numeric(7, 2) not null,
  carga_ref_h  numeric(7, 2) not null,
  saldo_h      numeric(7, 2) not null,
  gerado_em    timestamptz not null default now(),
  arquivo_pdf  text,
  unique (user_id, mes)
);
