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
