import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  try {
    console.log('🧪 Testando conexão com Supabase...');
    console.log('🔗 URL do Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('🔑 Chave anon definida:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // Teste 1: Verificar se o cliente foi criado
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Cliente Supabase não foi criado',
      });
    }

    // Teste 2: Conectividade básica
    const { data: pingData, error: pingError } = await supabase.rpc('ping');
    console.log('🏓 Ping test:', { pingData, pingError });

    // Teste 3: Verificar se a tabela institutions existe
    const { data: tableTest, error: tableError } = await supabase
      .from('institutions')
      .select('count', { count: 'exact', head: true });
    
    console.log('🗄️ Teste de tabela:', { tableTest, tableError });

    // Teste 4: Verificar RLS (Row Level Security)
    const { data: rlsTest, error: rlsError } = await supabase
      .from('institutions')
      .select('*')
      .limit(1);
    
    console.log('🔐 Teste RLS:', { rlsTest, rlsError });

    // Teste 5: Listar todas as tabelas (se possível)
    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    console.log('📋 Tabelas disponíveis:', { tablesData, tablesError });

    return NextResponse.json({
      success: true,
      tests: {
        client: !!supabase,
        ping: { data: pingData, error: pingError },
        table: { data: tableTest, error: tableError },
        rls: { data: rlsTest, error: rlsError },
        tables: { data: tablesData, error: tablesError }
      },
      config: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    });

  } catch (error) {
    console.error('💥 Erro no teste:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}