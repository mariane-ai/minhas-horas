# Configuração — Supabase, Google e Vercel

Passo a passo para colocar a etapa 1 no ar. Nada aqui é feito pelo código: são configurações nos painéis.

## 1. Supabase — aplicar as migrations

Opção A, pelo painel (mais simples): **SQL Editor → New query**, cole e rode, **nesta ordem**, o conteúdo de:

1. `supabase/migrations/20261113000001_schema.sql`
2. `supabase/migrations/20261113000002_rls.sql`
3. `supabase/migrations/20261113000003_funcoes_sessao.sql`
4. `supabase/migrations/20261113000004_frentes_iniciais.sql`

Opção B, pela CLI: `supabase link --project-ref SEU_REF` e depois `supabase db push`.

Confira em **Table Editor** que as 6 tabelas aparecem com o selo "RLS enabled" e que `frentes` tem 8 linhas.

## 2. Google — cliente OAuth

1. No [Google Cloud Console](https://console.cloud.google.com/): crie (ou escolha) um projeto → **APIs e serviços → Tela de consentimento OAuth**: tipo "Externo", nome do app, seu e-mail de suporte. Em "Usuários de teste", adicione o seu e-mail Google (enquanto o app estiver em modo de teste, só esses usuários entram — o que aqui é desejável).
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, cole a *Callback URL* que o Supabase mostra em **Authentication → Sign In / Providers → Google** (formato `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
4. Copie o *Client ID* e o *Client secret*.

## 3. Supabase — ativar o Google

1. **Authentication → Sign In / Providers → Google**: ative e cole Client ID e Client secret.
2. **Authentication → URL Configuration**:
   - *Site URL*: a URL de produção da Vercel (ex.: `https://registro-horas.vercel.app`).
   - *Redirect URLs*: adicione `https://SUA-URL.vercel.app/auth/callback` e, para desenvolvimento, `http://localhost:3000/auth/callback`.

## 4. Vercel

1. **Add New → Project** → importe o repositório `mariane-ai/girassol` (framework: Next.js, sem alterar comandos).
2. Em **Environment Variables**, cadastre (valores em Supabase → Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (a *publishable key*; a *anon key* antiga também funciona)
   - `ALLOWED_EMAILS` — o seu e-mail Google. Sem esta variável ninguém entra.
3. Deploy. Depois, volte ao passo 3.2 se a URL final for diferente da que você cadastrou.

## 5. Regra de contrato inicial (você preenche)

Depois do **primeiro login** no app (é ele que cria o seu usuário no Supabase), rode no SQL Editor,
trocando os três campos marcados:

```sql
insert into public.regras_contrato (user_id, carga_semanal_h, valor_mensal, limite_alerta_h, vigencia_inicio)
select id, 18, null, null, 'AAAA-MM-DD'   -- data de início do contrato
from auth.users
where email = 'SEU-EMAIL@gmail.com';
```

- `valor_mensal` e `limite_alerta_h` podem ficar `null` agora e ser preenchidos depois no Table Editor.
- Sem essa regra, a tela da semana mostra as horas mas deixa carga de referência e saldo em "—".
- Mudança futura de carga: preencha `vigencia_fim` da regra atual e insira uma nova regra a partir do dia seguinte (o banco recusa vigências sobrepostas).

## 6. Instalar no celular

Abra a URL da Vercel no celular → menu do navegador → **Adicionar à tela de início** (Android/Chrome: "Instalar app").

## Desenvolvimento local

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes do cálculo de horas
```
