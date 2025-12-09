import { createClient } from '@supabase/supabase-js';

// Configuração das variáveis de ambiente do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente Supabase configurado para uso no lado do cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);