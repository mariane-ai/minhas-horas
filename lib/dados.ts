import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Local, Pausa } from "./horas";
import { inicioDoDiaUtc, somarDias } from "./tempo";

export interface Frente {
  id: number;
  nome: string;
}

export interface SessaoAberta {
  id: string;
  inicio: string;
  pausas: Pausa[];
}

export interface SessaoDaSemana {
  id: string;
  inicio: string;
  fim: string;
  local: Local;
  observacao: string | null;
  frente: string;
  pausas: Pausa[];
}

export interface RegraVigente {
  carga_semanal_h: number;
}

export async function buscarFrentesAtivas(supabase: SupabaseClient): Promise<Frente[]> {
  const { data, error } = await supabase
    .from("frentes")
    .select("id, nome")
    .eq("ativa", true)
    .order("ordem");
  if (error) throw error;
  return data;
}

export async function buscarSessaoAberta(supabase: SupabaseClient): Promise<SessaoAberta | null> {
  const { data, error } = await supabase
    .from("sessoes")
    .select("id, inicio, pausas(inicio, fim)")
    .is("fim", null)
    .is("excluida_em", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, pausas: ordenarPausas(data.pausas) };
}

/** Sessões encerradas que começaram entre segunda 00:00 e a segunda seguinte (SP). */
export async function buscarSessoesDaSemana(
  supabase: SupabaseClient,
  segunda: string,
): Promise<SessaoDaSemana[]> {
  const de = inicioDoDiaUtc(segunda).toISOString();
  const ate = inicioDoDiaUtc(somarDias(segunda, 7)).toISOString();
  const { data, error } = await supabase
    .from("sessoes")
    .select("id, inicio, fim, local, observacao, frentes(nome), pausas(inicio, fim)")
    .gte("inicio", de)
    .lt("inicio", ate)
    .not("fim", "is", null)
    .is("excluida_em", null)
    .order("inicio");
  if (error) throw error;
  return data.map((s) => {
    const frente = s.frentes as unknown as { nome: string } | null;
    return {
      id: s.id,
      inicio: s.inicio,
      fim: s.fim as string,
      local: s.local as Local,
      observacao: s.observacao,
      frente: frente?.nome ?? "—",
      pausas: ordenarPausas(s.pausas),
    };
  });
}

/** Regra de contrato vigente numa data (AAAA-MM-DD); vigencia_fim é inclusiva. */
export async function buscarRegraVigente(
  supabase: SupabaseClient,
  data: string,
): Promise<RegraVigente | null> {
  const { data: regra, error } = await supabase
    .from("regras_contrato")
    .select("carga_semanal_h")
    .lte("vigencia_inicio", data)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${data}`)
    .order("vigencia_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return regra ? { carga_semanal_h: Number(regra.carga_semanal_h) } : null;
}

function ordenarPausas(pausas: Pausa[] | null): Pausa[] {
  return [...(pausas ?? [])].sort((a, b) => a.inicio.localeCompare(b.inicio));
}
