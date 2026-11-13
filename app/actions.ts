"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { exigirUsuaria } from "@/lib/supabase/server";

export interface Resultado {
  erro?: string;
  ok?: boolean;
}

function mensagem(error: PostgrestError): string {
  // P0001 = mensagens escritas nas funções do banco, já em português.
  if (error.code === "P0001") return error.message;
  console.error(error);
  return "Não foi possível salvar. Verifique a conexão e tente de novo.";
}

function atualizar() {
  revalidatePath("/");
  revalidatePath("/semana");
}

export async function iniciarSessao(): Promise<Resultado> {
  const { supabase } = await exigirUsuaria();
  const { error } = await supabase.rpc("iniciar_sessao");
  if (error) return { erro: mensagem(error) };
  atualizar();
  return { ok: true };
}

export async function pausarSessao(sessaoId: string): Promise<Resultado> {
  const { supabase } = await exigirUsuaria();
  const { error } = await supabase.rpc("pausar_sessao", { p_sessao: sessaoId });
  if (error) return { erro: mensagem(error) };
  atualizar();
  return { ok: true };
}

export async function retomarSessao(sessaoId: string): Promise<Resultado> {
  const { supabase } = await exigirUsuaria();
  const { error } = await supabase.rpc("retomar_sessao", { p_sessao: sessaoId });
  if (error) return { erro: mensagem(error) };
  atualizar();
  return { ok: true };
}

export async function encerrarSessao(_anterior: Resultado, form: FormData): Promise<Resultado> {
  const { supabase } = await exigirUsuaria();

  const sessaoId = String(form.get("sessao_id") ?? "");
  const frente = Number(form.get("frente_id"));
  const local = String(form.get("local") ?? "");
  const observacao = String(form.get("observacao") ?? "").trim();

  if (!sessaoId) return { erro: "Sessão não encontrada." };
  if (!Number.isInteger(frente) || frente <= 0) return { erro: "Escolha a frente." };
  if (local !== "girassol" && local !== "externo") return { erro: "Escolha o local." };
  if (observacao.length > 1000) return { erro: "A observação pode ter no máximo 1000 caracteres." };

  const { error } = await supabase.rpc("encerrar_sessao", {
    p_sessao: sessaoId,
    p_frente: frente,
    p_local: local,
    p_observacao: observacao || null,
  });
  if (error) return { erro: mensagem(error) };
  atualizar();
  return { ok: true };
}
