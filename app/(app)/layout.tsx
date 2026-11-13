import { sair } from "@/app/auth/actions";
import { NavInferior } from "@/components/NavInferior";

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <span className="text-sm font-semibold text-stone-500">Registro de horas</span>
        <form action={sair}>
          <button type="submit" className="rounded-lg px-2 py-1 text-sm text-stone-500 underline-offset-4 hover:underline">
            Sair
          </button>
        </form>
      </header>
      <div className="flex flex-1 flex-col pb-20">{children}</div>
      <NavInferior />
    </>
  );
}
