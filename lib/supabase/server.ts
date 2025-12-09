import { createClient } from '@supabase/supabase-js';

// Cliente Supabase otimizado para uso no servidor
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Não persistir sessão no servidor
    autoRefreshToken: false, // Não renovar token automaticamente
    detectSessionInUrl: false // Não detectar sessão na URL
  },
  global: {
    fetch: fetch, // Usar fetch nativo
  }
});