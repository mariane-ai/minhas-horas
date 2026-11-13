"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Sessão" },
  { href: "/semana", rotulo: "Semana" },
] as const;

export function NavInferior() {
  const caminho = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-[var(--background)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800"
    >
      <ul className="mx-auto grid max-w-md grid-cols-2">
        {ITENS.map(({ href, rotulo }) => {
          const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={`flex h-14 items-center justify-center text-sm font-semibold ${
                  ativo ? "text-amber-700 dark:text-amber-400" : "text-stone-500"
                }`}
              >
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
