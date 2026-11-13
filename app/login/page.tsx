import { BotaoGoogle } from "./BotaoGoogle";

const MENSAGENS: Record<string, string> = {
  "nao-autorizado": "Esta conta Google não tem acesso a este app.",
  falha: "O login não foi concluído. Tente de novo.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { erro } = await searchParams;
  const mensagem = typeof erro === "string" ? MENSAGENS[erro] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-bold tracking-tight">Registro de horas</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        Horas prestadas no Restaurante Girassol.
      </p>
      {mensagem && (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {mensagem}
        </p>
      )}
      <div className="mt-8">
        <BotaoGoogle />
      </div>
    </main>
  );
}
