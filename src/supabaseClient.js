import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* ---------------------------------------------------------------------
   Camada "compatível com localStorage", só que salvando no Supabase.
   Cada chave (ex: "meta-atual") vira uma linha na tabela app_data.
   ------------------------------------------------------------------- */

export async function cloudGetItem(chave) {
  const { data, error } = await supabase
    .from("app_data")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();

  if (error) {
    console.error(`Erro ao ler "${chave}" do Supabase:`, error);
    return null;
  }
  return data ? data.valor : null;
}

export async function cloudSetItem(chave, valor) {
  const { error } = await supabase
    .from("app_data")
    .upsert({ chave, valor, atualizado_em: new Date().toISOString() });

  if (error) {
    console.error(`Erro ao salvar "${chave}" no Supabase:`, error);
  }
}

/* ---------------------------------------------------------------------
   Migração única: se o Supabase ainda não tem nada para essa chave,
   mas o localStorage deste navegador tem, sobe o valor uma vez.
   Assim os dados que já existem no seu PC não se perdem.
   ------------------------------------------------------------------- */
export async function migrarDoLocalStorageSeNecessario(chaves) {
  for (const chave of chaves) {
    try {
      const existente = await cloudGetItem(chave);
      if (existente !== null) continue; // já tem dado na nuvem, não sobrescreve

      const local = localStorage.getItem(chave);
      if (local) {
        await cloudSetItem(chave, JSON.parse(local));
        console.log(`Migrado "${chave}" do localStorage para o Supabase.`);
      }
    } catch (e) {
      console.error(`Falha ao migrar "${chave}":`, e);
    }
  }
}
