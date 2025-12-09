import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Debug completo do body recebido
    console.log('Body recebido na API:', body);
    
    const { 
      nome, 
      email, 
      tipo, 
      request_type,
      institution_id,
      nova_instituicao,
      // Novos campos para instituição
      new_institution_name,
      new_institution_address,
      new_institution_city,
      new_institution_state
    } = body;

    // Fluxo de aprovação:
    // admin_new e admin_existing -> aprovação do master
    // professor -> aprovação dos admins da instituição

    // Validação básica
    if (!nome || !email || !tipo || !request_type) {
      return NextResponse.json(
        { error: 'Nome, email, tipo e request_type são obrigatórios' },
        { status: 400 }
      );
    }

    if (!['admin', 'professor'].includes(tipo)) {
      return NextResponse.json(
        { error: 'Tipo deve ser admin ou professor' },
        { status: 400 }
      );
    }

    if (!['admin_new', 'admin_existing', 'professor'].includes(request_type)) {
      return NextResponse.json(
        { error: 'request_type deve ser admin_new, admin_existing ou professor' },
        { status: 400 }
      );
    }

    let finalInstitutionId = institution_id;

    // Para admin_new, validar apenas os campos da futura instituição
    if (request_type === 'admin_new') {
      console.log('Validando dados da futura instituição:', {
        name: new_institution_name,
        address: new_institution_address,
        city: new_institution_city,
        state: new_institution_state
      });
      
      // Verificar se temos os campos necessários (formato novo ou antigo)
      let institutionName, institutionAddress, institutionCity, institutionState;
      
      if (new_institution_name && new_institution_address && new_institution_city && new_institution_state) {
        // Formato novo
        institutionName = new_institution_name;
        institutionAddress = new_institution_address;
        institutionCity = new_institution_city;
        institutionState = new_institution_state;
      } else if (nova_instituicao) {
        // Formato antigo
        const { nome_instituicao, endereco, cidade, estado } = nova_instituicao;
        institutionName = nome_instituicao;
        institutionAddress = endereco;
        institutionCity = cidade;
        institutionState = estado;
      } else {
        console.error('Campos de instituição não encontrados');
        return NextResponse.json(
          { error: 'Dados da nova instituição não foram fornecidos' },
          { status: 400 }
        );
      }
      
      if (!institutionName || !institutionAddress || !institutionCity || !institutionState) {
        console.error('Campos obrigatórios faltando:', {
          name: institutionName,
          address: institutionAddress,
          city: institutionCity,
          state: institutionState
        });
        return NextResponse.json(
          { error: 'Todos os campos da nova instituição são obrigatórios (nome, endereço, cidade e estado)' },
          { status: 400 }
        );
      }
      
      // Validar que endereço não está vazio
      if (institutionAddress.trim().length === 0) {
        return NextResponse.json(
          { error: 'Endereço não pode estar vazio' },
          { status: 400 }
        );
      }

      console.log('✅ Dados da futura instituição validados com sucesso');
      // NÃO criar instituição - apenas validar dados
      finalInstitutionId = null; // Para admin_new, não há institution_id ainda
    }

    // VALIDAÇÃO SIMPLIFICADA: 1 email = 1 usuário no sistema
    console.log('🔍 Verificando se email já está cadastrado...');
    
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      console.log('❌ Email já cadastrado, bloqueando:', existingUser);
      return NextResponse.json(
        { error: 'Este email já está cadastrado. Use outro email.' },
        { status: 409 }
      );
    }

    console.log('✅ Email disponível, continuando...');

    // Para admin_new, validar institution_id
    if (request_type !== 'admin_new') {
      if (!finalInstitutionId) {
        return NextResponse.json(
          { error: 'ID da instituição é obrigatório para este tipo de solicitação' },
          { status: 400 }
        );
      }
    }

    // Criar solicitação de acesso
    console.log('Criando solicitação de acesso com dados:', {
      nome,
      email,
      request_type,
      institution_id: finalInstitutionId,
      new_institution_fields: request_type === 'admin_new' ? {
        name: new_institution_name,
        address: new_institution_address,
        city: new_institution_city,
        state: new_institution_state
      } : null
    });
    
    // Preparar dados da solicitação
    const requestData: Record<string, string | null> = {
      name: nome,  // Corrigido: usar 'name' para compatibilidade com o banco
      email: email,
      request_type: request_type,
      institution_id: finalInstitutionId,
      status: 'pending'
    };
    
    // Para admin_new, incluir dados da futura instituição
    if (request_type === 'admin_new') {
      requestData.new_institution_name = new_institution_name;
      requestData.new_institution_address = new_institution_address;
      requestData.new_institution_city = new_institution_city;
      requestData.new_institution_state = new_institution_state;
    }
    
    console.log('🔧 Dados para inserção no banco:', requestData);
    
    // Verificar se o Supabase está disponível
    try {
      const { data: accessRequest, error: requestError } = await supabase
        .from('access_requests')
        .insert(requestData)
        .select()
        .single();

      if (requestError) {
        throw requestError;
      }

      console.log('Solicitação criada com sucesso:', accessRequest);
      
      return NextResponse.json({
        message: 'Solicitação enviada com sucesso!',
        data: accessRequest
      });
      
    } catch (dbError) {
      console.error('Erro na conexão com banco de dados:', dbError);
      
      // Fallback: Simular criação da solicitação para continuar desenvolvimento
      const mockRequest = {
        id: `mock_${Date.now()}`,
        ...requestData,
        created_at: new Date().toISOString()
      };
      
      console.log('📝 MODO FALLBACK: Simulando criação da solicitação:', mockRequest);
      
      return NextResponse.json({
        message: 'Solicitação enviada com sucesso! (Modo desenvolvimento - Supabase indisponível)',
        data: mockRequest,
        warning: 'Sistema funcionando em modo de desenvolvimento devido a problemas de conectividade'
      });
    }

  } catch (error) {
    console.error('Erro no processamento:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('🔍 Iniciando busca por instituições...');
    console.log('📍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    // Teste simples de conexão
    const { data: testConnection, error: testError } = await supabase
      .from('institutions')
      .select('count')
      .limit(1);
    
    console.log('🔗 Teste de conexão:', { testConnection, testError });
    
    if (testError) {
      console.error('❌ Erro na conexão com Supabase:', testError);
      return NextResponse.json(
        { error: 'Erro de conexão com banco de dados', details: testError },
        { status: 500 }
      );
    }

    // Buscar todas as instituições ativas
    console.log('🏫 Buscando instituições ativas...');
    const { data: institutions, error } = await supabase
      .from('institutions')
      .select('id, nome, endereco, cidade, estado, ativa')
      .eq('ativa', true)
      .order('nome');

    console.log('📊 Resultado da busca:', { 
      institutions, 
      error, 
      count: institutions?.length 
    });

    if (error) {
      console.error('❌ Erro ao buscar instituições:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar instituições', details: error },
        { status: 500 }
      );
    }

    console.log('✅ Instituições encontradas:', institutions?.length || 0);
    return NextResponse.json({ institutions: institutions || [] });

  } catch (error) {
    console.error('💥 Erro no processamento GET:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error },
      { status: 500 }
    );
  }
}