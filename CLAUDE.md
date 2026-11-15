# Minhas Horas

Decisões de 15/11/2026. O contexto pessoal (quem usa, para quê) fica fora do repositório, que é público.

## O que é

Webapp pessoal para controlar as horas de um contrato (hoje 15 h por semana; pode mudar) e trabalhar com flexibilidade fora dos dias e horários de referência, sem fazer horas a mais ou a menos do que o contratado.

Uso individual: os dados ficam no celular, sem servidor, sem login e sem analytics. Ninguém além da usuária acessa. Celular Android (Chrome), instalado na tela inicial.

## Linguagem das telas

- Português do Brasil, horas em 24 h, tom neutro.
- Não usar: "banco de horas", "ponto", "jornada", "empresa", "patrão".
- Termos: **Feito**, **Previsto**, **Saldo**, **Meta da semana**.

## Regras

- Semana de segunda a domingo.
- **Cota com vigência**: lista `{a partir de, horas por semana}`. Mudar a cota não recalcula as semanas anteriores.
- **Saldo inicial** (configuração): data de início, horas e sentido (adiantadas ou a repor). Começa em 16/11/2026, com o valor que ela informar.
- **Saldo corrido**, sem prazo para zerar: saldo inicial + Σ(feito − cota) das semanas fechadas + ajustes. Mostrar por extenso, sem sinal: "3 h adiantadas" ou "2 h a repor".
- **Meta da semana** = cota − horas adiantadas (ou + horas a repor). Topo da tela: feito X h de Y h, previsto Z h, barra.
- **Ajuste**: lançamento com data, horas, sentido e observação (acordo para abater ou zerar o saldo, semana de férias).
- **Período**: data, início, término, observação, tipo Previsto ou Feito.
  - Feito só no presente ou no passado: botões "Começar agora" (abre período) e "Encerrar agora", ou lançamento manual com término ≤ agora.
  - Previsto pode ter datas futuras. Previsto que já passou ganha o botão "Fiz assim": vira Feito pré-preenchido e editável.
- **Recusar**: qualquer minuto entre 00:00 e 05:00 (faixa proibida; terminar às 24:00 em ponto vale), término ≤ início, sobreposição entre Feitos (ou entre Previstos). Previsto e Feito podem se sobrepor.
- **Período aberto esquecido**: ao abrir o app, se um período aberto entrou na faixa proibida ou passou de 12 h, pedir para corrigir o término.
- **Aviso** (sem bloquear) quando um lançamento fizer a semana passar da meta.

## Telas

1. **Hoje** (abre direto aqui): placar da semana, botão grande Começar ou Encerrar agora, formulário (início e término preenchidos com agora, observação, Salvar), previsto do dia como referência, lista da semana com editar e excluir e setas para semanas anteriores.
2. **Previsão**: montar a semana seguinte (ou qualquer semana futura), com total comparado à meta. Botões Enviar (`navigator.share`, para o WhatsApp) e Copiar. Formato:
   ```
   Previsão da semana 23/11 a 29/11
   Ter 24/11 · 13:00–18:00
   Qua 25/11 · 08:00–12:00 e 13:00–14:00
   Sex 27/11 · 09:00–14:00
   Total: 15 h
   ```
3. **Ajustes e configuração**: cota com vigência, saldo inicial, ajustes, backup.

## Backup

- Exportar CSV (abre no Sheets) e JSON. Importar JSON.
- Faixa de aviso quando o último backup tiver mais de 7 dias.
- v2 (backlog, não fazer agora): backup automático no Google Drive dela, com login Google e escopo restrito ao arquivo do app.

## Técnica

- PWA estática sem build: `index.html`, CSS e JS sem framework, manifest, service worker (offline), ícones PNG 192 e 512 (desenho simples, sem marca).
- Dados em `localStorage`, numa chave versionada (`minhas-horas:v1`), com try/catch. Nenhuma chamada de rede além dos arquivos do app. Fuso do aparelho.
- Hospedagem: GitHub Pages da `main`.
- Ao mudar arquivos do app, subir a versão do cache no `sw.js` para o celular pegar a atualização.

## A armadilha

- Dados presos no celular: limpar o Chrome ou trocar de aparelho apaga tudo. Mitigação: exportação e lembrete semanal até a v2.
- Lançar pelo navegador e não pelo ícone instalado. No Android a origem é a mesma, mas convém orientar o uso pelo ícone.
- Período aberto esquecido: tratado nas regras.

## Testes

Playwright com emulação de Android (Pixel 7), em `tests/`. Cobrir as regras de recusa, a virada de semana, o saldo com cota mudando no meio, o "Fiz assim", a exportação e a importação, e o funcionamento offline. Prints das telas em `tests/prints/` para conferência. Depois, teste da usuária final por uma semana.

## Fechamento

Commit e push no fim de cada bloco. Repositório público: nunca commitar nomes, dados pessoais ou backups com horas reais.
