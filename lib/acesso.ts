// Lista de e-mails autorizados, lida da variável de ambiente ALLOWED_EMAILS
// (separados por vírgula). Nenhum e-mail fica no código. Sem a variável, ninguém entra.

export function emailAutorizado(email: string | null | undefined): boolean {
  if (!email) return false;
  const lista = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}
