# Registro de Horas — prestação de serviço

## O que é
Registro pessoal das horas de prestação de serviço da Mariane (PJ) no Restaurante Girassol.
Valor fixo mensal por carga de referência de 18 h/semana. O app mostra o saldo em horas para uma
revisão futura de valor; não calcula pagamento, hora extra nem desconto.

## Regras inegociáveis
- Linguagem: nunca usar "ponto", "jornada", "expediente" ou "hora extra". Usar "sessão",
  "horas prestadas", "carga de referência", "saldo".
- Sigilo: nenhum campo pede nome ou dado identificável de colaborador. A observação livre exibe
  o aviso "Não registre nomes nem dados de colaboradores".
- Rastro: toda edição grava em `correcoes` (valor antigo, novo, motivo obrigatório, data).
  Exclusão é lógica (`excluida_em`).
- Vigência: carga e valor vêm de `regras_contrato` conforme a data da sessão; mudar regra não
  altera meses passados.
- Saldo só em horas, nunca em reais.
- Fuso America/Sao_Paulo; semana de segunda a domingo.

## Stack
Next.js (App Router), Supabase (projeto da Mariane, RLS ativo), Vercel, PWA, login Google, pt-BR.

## Modelo de dados
- frentes(id, nome, ativa, ordem)
- sessoes(id, inicio, fim, frente_id, local[girassol|externo], observacao, lancada_depois,
  excluida_em, criada_em)
- pausas(id, sessao_id, inicio, fim)
- correcoes(id, sessao_id, campo, valor_antigo, valor_novo, motivo, corrigida_em)
- regras_contrato(id, carga_semanal_h, valor_mensal, limite_alerta_h, vigencia_inicio, vigencia_fim)
- fechamentos(id, mes, total_h, carga_ref_h, saldo_h, gerado_em, arquivo_pdf)

Frentes iniciais: Trilha de Liderança, Treinamento de atendimento, Seleção, Atestados,
Escuta/acolhimento, Reuniões, Planejamento/estudo, Outros.

## Etapas
1. Base: auth, migrations, iniciar/pausar/encerrar, lista da semana com saldo.
2. Lançamento manual e correções com histórico.
3. Painel: semana, mês, saldo acumulado, média de 4 semanas, horas por frente, alerta de excesso.
4. Relatórios: mensal (PDF + CSV) e de período para revisão.
5. (v2) Selo de localização, lembrete de sessão aberta, aceite mensal.

## Não decidir sozinho
Regra de compensação de saldo, aceite do Girassol e contagem de horas externas são decisões da
Mariane. Pergunte antes de implementar qualquer coisa nessa direção.

## Andamento
(atualizar a cada etapa)

### Etapa 1 — concluída no código (13/11/2026), branch `etapa-1`
Feito:
- Next.js 16 (App Router, TypeScript, Tailwind 4), `@supabase/ssr`. No Next 16 o middleware
  chama-se `proxy.ts`. `cacheComponents` desligado (todas as páginas são dinâmicas).
- Login Google (Supabase Auth): `app/login`, `app/auth/callback`. Acesso restrito por
  `ALLOWED_EMAILS` (variável de ambiente; nenhum e-mail no código), checado no proxy, no callback
  e em `exigirUsuaria()` (`lib/supabase/server.ts`).
- Migrations em `supabase/migrations/`: esquema, RLS, funções de sessão, frentes iniciais.
  Validadas num Postgres 16 local com um `auth` simulado (fluxo completo, isolamento entre
  usuárias, correções imutáveis, sem DELETE, vigências sem sobreposição). Ainda não aplicadas no
  projeto Supabase real.
- Acréscimos ao modelo (aprovados): `user_id` (default `auth.uid()`) em `sessoes`,
  `regras_contrato` e `fechamentos`; `pausas` e `correcoes` herdam a dona pela sessão.
  `valor_mensal` e `limite_alerta_h` são opcionais. Trigger impede vigências sobrepostas.
- Iniciar/pausar/retomar/encerrar via funções do banco (`iniciar_sessao`, `pausar_sessao`,
  `retomar_sessao`, `encerrar_sessao`), `security invoker`, horário sempre do banco (`now()`).
  Uma sessão aberta por usuária; uma pausa aberta por sessão; encerrar fecha a pausa aberta.
- Tela `/`: cronômetro de horas prestadas (descontando pausas, relógio ancorado no servidor) e
  formulário de encerramento: frente, local e observação opcional com o aviso de sigilo.
- Tela `/semana`: sessões encerradas por dia, navegação entre semanas, total, carga de
  referência, saldo e subtotais Girassol/externo.
- PWA: `app/manifest.ts`, ícones em `public/icons`, `public/sw.js` mínimo (sem cache de dados).
- Testes: `lib/horas.test.ts` (Vitest), 14 casos de cálculo, fuso e semana.
- Guia de configuração: `docs/configuracao.md`.

Decisões registradas:
- Horas externas **entram no total e no saldo**, com subtotais Girassol/externo à vista
  (decisão da Mariane, 13/11/2026).
- A sessão pertence ao dia e à semana em que **começou** (fuso SP), mesmo se passar da meia-noite.
- A carga da semana é a da regra vigente na **segunda-feira** daquela semana.
- Horas exibidas em minutos inteiros (arredondamento para baixo por sessão).
- A regra de contrato inicial (18 h/semana, já vigente) é inserida pela Mariane via SQL
  (`docs/configuracao.md`, passo 5), com o valor preenchido só no painel do Supabase,
  fora do Git.

Pendências da Mariane para a etapa 1 rodar:
- Aplicar as migrations, configurar o OAuth do Google e as variáveis na Vercel, e inserir a
  regra inicial com a data de início do contrato (`docs/configuracao.md`).

### Próxima: etapa 2 — lançamento manual e correções com histórico
- Lançar sessão depois (`lancada_depois = true`), com início, fim, pausas, frente e local.
- Editar sessão encerrada: cada campo alterado gera uma linha em `correcoes` (valor antigo,
  novo, motivo obrigatório), de preferência numa função do banco para gravar tudo junto.
- Exclusão lógica (`excluida_em`) com motivo, também registrada em `correcoes`.
- Ver o histórico de correções na sessão.
- Validar a sobreposição entre sessões (hoje só a sessão aberta é única).
- Perguntar à Mariane antes de qualquer regra de compensação de saldo.
