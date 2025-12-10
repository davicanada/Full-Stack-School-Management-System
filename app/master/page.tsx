'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { supabase } from '@/lib/supabase/client';
import { hashPassword } from '@/lib/auth/password';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  institution_id?: string;
  created_at?: string;
}

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  request_type: string;
  status: string;
  new_institution_name?: string;
  new_institution_address?: string;
  new_institution_city?: string;
  new_institution_state?: string;
  institution_id?: string;
  created_at: string;
}

interface Institution {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  created_at?: string;
}

export default function MasterPage() {
  // Main states
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('solicitacoes');
  
  // States for Solicitações
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  
  // States for Usuários
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userInstitutionFilter, setUserInstitutionFilter] = useState('');
  
  // States for Instituições
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  
  const router = useRouter();

  // Function to buscar solicitações pendentes (extraída para uso global)
  const fetchPendingRequests = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar solicitações:', error);
        toast.error('Erro ao carregar solicitações');
        return;
      }

      setRequests(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Verificar autenticação e papel do usuário
  useEffect(() => {
    const checkAuth = () => {
      const userData = localStorage.getItem('user');
      if (!userData) {
        toast.error('Acesso negado. Faça login primeiro.');
        router.push('/');
        return;
      }

      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'master') {
        toast.error('Acesso negado. Apenas usuários master podem acessar esta página.');
        router.push('/');
        return;
      }

      setUser(parsedUser);
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const { data, error } = await supabase
          .from('institutions')
          .select('*');

        if (error) {
          console.error('Erro ao buscar instituições:', error);
          return;
        }

        setInstitutions(data || []);
      } catch (error) {
        console.error('Erro:', error);
      }
    };

    if (user) {
      fetchPendingRequests();
      fetchInstitutions();
    }
  }, [user, fetchPendingRequests]);

  // Buscar todos os usuários do sistema
  const fetchAllUsers = async () => {
    try {
      setUsersLoading(true);

      // Buscar usuários básicos
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Erro ao buscar usuários:', usersError);
        toast.error('Erro ao carregar usuários');
        return;
      }

      if (!users || users.length === 0) {
        setAllUsers([]);
        return;
      }

      console.log('📊 Usuários encontrados:', users.length);

      // Para professores sem institution_id, buscar através de user_institutions
      const professorsWithoutInstitution = users.filter(user => 
        user.role === 'professor' && !user.institution_id
      );

      console.log('👨‍🏫 Professores sem institution_id:', professorsWithoutInstitution.length);

      if (professorsWithoutInstitution.length > 0) {
        // Buscar instituições dos professores através de user_institutions
        const professorIds = professorsWithoutInstitution.map(prof => prof.id);
        
        const { data: userInstitutions, error: userInstError } = await supabase
          .from('user_institutions')
          .select(`
            user_id,
            institution_id,
            institutions!inner(
              id,
              name
            )
          `)
          .in('user_id', professorIds);

        if (userInstError) {
          console.error('❌ Erro ao buscar user_institutions:', userInstError);
        } else {
          console.log('🔗 User_institutions encontrados:', userInstitutions?.length || 0);
          
          // Mapeamento para facilitar busca
          const institutionMap = new Map();
          userInstitutions?.forEach(ui => {
            institutionMap.set(ui.user_id, {
              institution_id: ui.institution_id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              institution_name: (ui.institutions as any)?.name || (ui.institutions as any)?.[0]?.name || 'N/A'
            });
          });

          // Atualizar professores com dados de instituição
          professorsWithoutInstitution.forEach(professor => {
            const instInfo = institutionMap.get(professor.id);
            if (instInfo) {
              professor.institution_id = instInfo.institution_id;
              professor._institution_name = instInfo.institution_name;
              console.log(`✅ Professor ${professor.name} → ${instInfo.institution_name}`);
            } else {
              console.log(`❌ Professor ${professor.name} → SEM INSTITUIÇÃO`);
            }
          });
        }
      }

      setAllUsers(users);
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setUsersLoading(false);
    }
  };

  // Buscar todas as instituições com contadores
  const fetchAllInstitutions = async () => {
    try {
      setInstitutionsLoading(true);

      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar instituições:', error);
        toast.error('Erro ao carregar instituições');
        return;
      }

      setInstitutions(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar instituições');
    } finally {
      setInstitutionsLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    toast.success('Logout realizado com sucesso!');
    router.push('/');
  };

  // Function to formatar tipo de solicitação
  const formatRequestType = (requestType: string) => {
    switch (requestType) {
      case 'admin_new':
        return 'Administrador - Nova Instituição';
      case 'admin_existing':
        return 'Administrador - Instituição Existente';
      case 'professor':
        return 'Professor';
      default:
        return requestType;
    }
  };

  // Function to formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to aprovar solicitações
  const handleApprove = async (request: AccessRequest) => {
    if (!user) return;

    try {
      setIsProcessing(true);
      setProcessingRequestId(request.id);

      console.log('Processando aprovação para:', request);

      if (request.request_type === 'admin_new') {
        // 1. Criar nova instituição
        const { data: newInstitution, error: instError } = await supabase
          .from('institutions')
          .insert({
            name: request.new_institution_name,
            address: request.new_institution_address,
            city: request.new_institution_city,
            state: request.new_institution_state
          })
          .select()
          .single();

        if (instError) {
          console.error('Erro ao criar instituição:', instError);
          throw new Error('Erro ao criar instituição');
        }

        console.log('Instituição criada:', newInstitution);

        // 2. Criar usuário admin
        // Hash da senha padrão
        const hashedPassword = await hashPassword('senha123');

        const { data: newAdminUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: request.email,
            name: request.name,
            password_hash: hashedPassword,
            role: 'admin',
            institution_id: newInstitution.id
          })
          .select()
          .single();

        if (userError) {
          console.error('Erro ao criar usuário admin:', userError);
          throw new Error('Erro ao criar usuário admin');
        }

        console.log('Usuário admin criado com sucesso');

        // 3. Adicionar também na tabela user_institutions para suporte a múltiplas instituições
        console.log('🔗 Adicionando admin em user_institutions...');
        
        // Preparar dados da inserção
        const insertData = {
          user_id: newAdminUser.id,
          institution_id: newInstitution.id,
          role: 'admin' // Definir role específico para esta instituição
        };
        
        console.log('📋 Dados a serem inseridos em user_institutions:', insertData);
        
        const { error: relationError } = await supabase
          .from('user_institutions')
          .insert(insertData);

        if (relationError) {
          console.warn('Erro ao adicionar admin em user_institutions (não crítico):', relationError);
          // Não falhar a aprovação por conta disso, pois o admin já tem institution_id
        } else {
          console.log('Admin também adicionado em user_institutions para suporte futuro a múltiplas instituições');
        }

      } else if (request.request_type === 'admin_existing') {
        console.log('🟡 PROCESSANDO APROVAÇÃO DE ADMIN_EXISTING - SEMPRE CRIANDO NOVO USUÁRIO');

        // SIMPLIFICADO: Sempre criar novo usuário (1 email = 1 usuário)
        // Hash da senha padrão
        const hashedPassword = await hashPassword('senha123');

        const { data: newAdminUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: request.email,
            name: request.name,
            password_hash: hashedPassword,
            role: 'admin',
            institution_id: request.institution_id
          })
          .select()
          .single();

        if (userError) {
          console.error('❌ Erro ao criar usuário admin:', userError);
          throw new Error(`Erro ao criar usuário admin: ${userError.message}`);
        }

        console.log('✅ Novo usuário admin criado:', newAdminUser);
        
        // Adicionar também na tabela user_institutions
        const { error: relationError } = await supabase
          .from('user_institutions')
          .insert({
            user_id: newAdminUser.id,
            institution_id: request.institution_id,
            role: 'admin'
          });

        if (relationError) {
          console.warn('❌ Erro ao criar vínculo em user_institutions (não crítico):', relationError);
        }
        
        console.log('✅ APROVAÇÃO DE ADMIN_EXISTING CONCLUÍDA COM SUCESSO!');

      } else if (request.request_type === 'professor') {
        console.log('🟡 PROCESSANDO APROVAÇÃO DE PROFESSOR - SEMPRE CRIANDO NOVO USUÁRIO');

        if (!request.institution_id) {
          throw new Error('Institution ID não encontrado na solicitação');
        }

        // SIMPLIFICADO: Sempre criar novo usuário (1 email = 1 usuário)
        console.log('Criando usuário COM institution_id (sistema consistente)');

        // Hash da senha padrão
        const hashedPassword = await hashPassword('senha123');

        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: request.email,
            name: request.name,
            password_hash: hashedPassword,
            role: 'professor',
            is_active: true,
            institution_id: request.institution_id  // ADICIONADO DE VOLTA para consistência
          })
          .select()
          .single();

        if (userError) {
          console.error('❌ Erro ao criar usuário professor:', userError);
          throw new Error(`Erro ao criar usuário professor: ${userError.message}`);
        }

        console.log('✅ Novo usuário professor criado:', newUser);
        
        // Adicionar na tabela user_institutions (para consistência futura)
        console.log('Professor tem institution_id direto + vínculo em user_institutions para consistência:', { 
          user_id: newUser.id, 
          institution_id: request.institution_id, 
          role: 'professor' 
        });
        
        const { error: userInstError } = await supabase
          .from('user_institutions')
          .insert({
            user_id: newUser.id,
            institution_id: request.institution_id,
            role: 'professor'
          });

        if (userInstError) {
          console.error('❌ Erro ao vincular professor à instituição:', userInstError);
          throw new Error(`Erro ao vincular professor à instituição: ${userInstError.message}`);
        }
        
        // Verificar se o vínculo foi criado
        const { data: checkLink } = await supabase
          .from('user_institutions')
          .select('*')
          .eq('user_id', newUser.id)
          .eq('institution_id', request.institution_id)
          .single();
        
        console.log('Vínculo criado?', checkLink);
        
        console.log('✅ APROVAÇÃO DE PROFESSOR CONCLUÍDA COM SUCESSO!');
      }

      // 3. Atualizar status da solicitação
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({ 
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('Erro ao atualizar solicitação:', updateError);
        throw new Error('Erro ao atualizar status da solicitação');
      }

      console.log('Solicitação aprovada com sucesso');
      toast.success(`Solicitação de ${request.name} aprovada com sucesso!`);
      
      // Recarregar lista de solicitações
      await fetchPendingRequests();

    } catch (error: unknown) {
      console.error('Erro ao aprovar solicitação:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao aprovar solicitação';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingRequestId(null);
    }
  };

  // Function to rejeitar solicitações
  const handleReject = async (request: AccessRequest) => {
    if (!user) return;

    try {
      setIsProcessing(true);
      setProcessingRequestId(request.id);

      console.log('Processando rejeição para:', request);

      // Atualizar status da solicitação
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({ 
          status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('Erro ao rejeitar solicitação:', updateError);
        throw new Error('Erro ao atualizar status da solicitação');
      }

      console.log('Solicitação rejeitada com sucesso');
      toast.success(`Solicitação de ${request.name} rejeitada.`);
      
      // Recarregar lista de solicitações
      await fetchPendingRequests();

    } catch (error: unknown) {
      console.error('Erro ao rejeitar solicitação:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao rejeitar solicitação';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingRequestId(null);
    }
  };

  // Function to deletar usuário
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!user) return;

    const confirmDelete = window.confirm(
      `Tem certeza que deseja deletar o usuário "${userName}"?\n\nEsta ação não pode ser desfeita.`
    );

    if (!confirmDelete) return;

    try {
      setUsersLoading(true);

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Erro ao deletar usuário:', error);
        toast.error('Erro ao deletar usuário. Verifique as permissões.');
        return;
      }

      toast.success(`Usuário "${userName}" deletado com sucesso!`);
      await fetchAllUsers(); // Recarregar lista de usuários

    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro interno ao deletar usuário');
    } finally {
      setUsersLoading(false);
    }
  };

  // Function to deletar instituição
  const handleDeleteInstitution = async (institutionId: string, institutionName: string) => {
    if (!user) return;

    // Verificar se tem usuários vinculados
    const usersInInstitution = getUserCountByInstitution(institutionId);
    
    if (usersInInstitution > 0) {
      toast.error(`Não é possível deletar a instituição "${institutionName}" pois ela possui ${usersInInstitution} usuário(s) vinculado(s).`);
      return;
    }

    const confirmDelete = window.confirm(
      `Tem certeza que deseja deletar a instituição "${institutionName}"?\n\nEsta ação não pode ser desfeita.`
    );

    if (!confirmDelete) return;

    try {
      setInstitutionsLoading(true);

      const { error } = await supabase
        .from('institutions')
        .delete()
        .eq('id', institutionId);

      if (error) {
        console.error('Erro ao deletar instituição:', error);
        toast.error('Erro ao deletar instituição. Verifique as permissões.');
        return;
      }

      toast.success(`Instituição "${institutionName}" deletada com sucesso!`);
      await fetchAllInstitutions(); // Recarregar lista de instituições
      
      // Se estamos na aba de usuários, recarregar também para atualizar filtros
      if (activeTab === 'usuarios') {
        await fetchAllUsers();
      }

    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro interno ao deletar instituição');
    } finally {
      setInstitutionsLoading(false);
    }
  };

  // Function to editar usuário (placeholder)
  const handleEditUser = () => {
    toast('Funcionalidade de edição de usuários em desenvolvimento', { icon: '🔧' });
  };

  // Function to editar instituição (placeholder)
  const handleEditInstitution = () => {
    toast('Funcionalidade de edição de instituições em desenvolvimento', { icon: '🔧' });
  };

  // Function to ver detalhes da instituição (placeholder)
  const handleViewInstitutionDetails = (institutionId: string) => {
    const usersCount = getUserCountByInstitution(institutionId);
    toast(`Instituição tem ${usersCount} usuário(s) vinculado(s)`, { icon: 'ℹ️' });
  };

  // Funções auxiliares para filtros e busca
  const getInstitutionName = (user: User | { institution_id?: string; _institution_name?: string }) => {
    // Se é um objeto usuário, usar _institution_name primeiro
    if (user && typeof user === 'object' && '_institution_name' in user && user._institution_name) {
      return user._institution_name;
    }
    
    // Se é um objeto usuário, pegar institution_id
    const institutionId = user && typeof user === 'object' ? user.institution_id : user;
    
    if (!institutionId) return 'Sem instituição';
    const institution = institutions.find(inst => inst.id === institutionId);
    return institution ? institution.name : 'Instituição não encontrada';
  };

  // Filtrar usuários baseado nos filtros ativos
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(userSearchTerm.toLowerCase());
    const matchesRole = userRoleFilter === '' || user.role === userRoleFilter;
    const matchesInstitution = userInstitutionFilter === '' || user.institution_id === userInstitutionFilter;
    
    return matchesSearch && matchesRole && matchesInstitution;
  });

  // Contar usuários por instituição
  const getUserCountByInstitution = (institutionId: string) => {
    return allUsers.filter(user => user.institution_id === institutionId).length;
  };

  // Handler para mudança de aba
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Carregar dados específicos da aba quando necessário
    if (tab === 'usuarios' && allUsers.length === 0) {
      fetchAllUsers();
    } else if (tab === 'instituicoes' && institutions.length === 0) {
      fetchAllInstitutions();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Painel Master - Controle Total
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Bem-vindo, {user.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Sistema de Abas */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => handleTabChange('solicitacoes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'solicitacoes'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              📋 Solicitações Pendentes
            </button>
            
            <button
              onClick={() => handleTabChange('usuarios')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'usuarios'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              👥 Todos os Usuários
            </button>
            
            <button
              onClick={() => handleTabChange('instituicoes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'instituicoes'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              🏢 Todas as Instituições
            </button>
            
            <button
              onClick={() => handleTabChange('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'logs'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              📊 Logs do Sistema
            </button>
            
            <button
              onClick={() => handleTabChange('configuracoes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'configuracoes'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              ⚙️ Configurações
            </button>
          </nav>
        </div>
      </div>

      {/* Conteúdo principal */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        {/* ABA: SOLICITAÇÕES PENDENTES */}
        {activeTab === 'solicitacoes' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Solicitações Pendentes
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Gerencie todas as solicitações de acesso ao sistema
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando solicitações...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Nenhuma solicitação pendente
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Todas as solicitações foram processadas.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {requests.map((request) => (
                  <div key={request.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {request.name}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          {request.email}
                        </p>
                        <span className="inline-block mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium rounded-full">
                          {formatRequestType(request.request_type)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(request.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Dados específicos baseados no tipo de solicitação */}
                    {request.request_type === 'admin_new' && (
                      <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-2">
                          Nova Instituição:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <p><strong>Nome:</strong> {request.new_institution_name}</p>
                          <p><strong>Cidade:</strong> {request.new_institution_city}</p>
                          <p><strong>Estado:</strong> {request.new_institution_state}</p>
                          <p className="md:col-span-2"><strong>Endereço:</strong> {request.new_institution_address}</p>
                        </div>
                      </div>
                    )}

                    {request.request_type === 'admin_existing' && request.institution_id && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                          Instituição Existente:
                        </h4>
                        <p className="text-sm">
                          <strong>Nome:</strong> {getInstitutionName(request)}
                        </p>
                      </div>
                    )}

                    {request.request_type === 'professor' && request.institution_id && (
                      <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <h4 className="font-medium text-orange-800 dark:text-orange-300 mb-2">
                          Instituição:
                        </h4>
                        <p className="text-sm">
                          <strong>Nome:</strong> {getInstitutionName(request)}
                        </p>
                      </div>
                    )}

                    {/* Botões de ação */}
                    <div className="mt-6 flex gap-3">
                      <button 
                        onClick={() => handleApprove(request)}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing && processingRequestId === request.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Aprovando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Aprovar
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => handleReject(request)}
                        disabled={isProcessing}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isProcessing && processingRequestId === request.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Rejeitando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Rejeitar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: TODOS OS USUÁRIOS */}
        {activeTab === 'usuarios' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Todos os Usuários
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Gerencie todos os usuários cadastrados no sistema
              </p>
            </div>

            {/* Filtros e busca */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Buscar usuário
                  </label>
                  <input
                    type="text"
                    placeholder="Nome ou email..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filtrar por role
                  </label>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Todos os roles</option>
                    <option value="master">Master</option>
                    <option value="admin">Admin</option>
                    <option value="professor">Professor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filtrar por instituição
                  </label>
                  <select
                    value={userInstitutionFilter}
                    onChange={(e) => setUserInstitutionFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Todas as instituições</option>
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setUserSearchTerm('');
                      setUserRoleFilter('');
                      setUserInstitutionFilter('');
                    }}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de usuários */}
            {usersLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando usuários...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Nenhum usuário encontrado
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Tente ajustar os filtros de busca.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Usuário
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Instituição
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Data Cadastro
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredUsers.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {userItem.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {userItem.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                              userItem.role === 'master' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              userItem.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                              'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                            }`}>
                              {userItem.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {getInstitutionName(userItem)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {userItem.created_at ? formatDate(userItem.created_at) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditUser()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                              >
                                Editar
                              </button>
                              {userItem.id !== user?.id && (
                                <button 
                                  onClick={() => handleDeleteUser(userItem.id, userItem.name)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition-colors"
                                >
                                  Deletar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA: TODAS AS INSTITUIÇÕES */}
        {activeTab === 'instituicoes' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Todas as Instituições
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Gerencie todas as instituições cadastradas no sistema
              </p>
            </div>

            {institutionsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-300">Carregando instituições...</p>
              </div>
            ) : institutions.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Nenhuma instituição encontrada
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  As instituições aprovadas aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {institutions.map((institution) => (
                  <div key={institution.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {institution.name}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        <p><strong>Endereço:</strong> {institution.address}</p>
                        <p><strong>Cidade:</strong> {institution.city} - {institution.state}</p>
                        <p><strong>Usuários:</strong> {getUserCountByInstitution(institution.id)}</p>
                        {institution.created_at && (
                          <p><strong>Criada em:</strong> {formatDate(institution.created_at)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewInstitutionDetails(institution.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Ver Detalhes
                      </button>
                      <button 
                        onClick={() => handleEditInstitution(institution.id, institution.name)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => handleDeleteInstitution(institution.id, institution.name)}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                        Deletar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: LOGS DO SISTEMA */}
        {activeTab === 'logs' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Logs do Sistema
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Visualize todas as ações importantes realizadas no sistema
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Funcionalidade em Desenvolvimento
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Em breve você poderá visualizar todos os logs de ações importantes do sistema.
              </p>
            </div>
          </div>
        )}

        {/* ABA: CONFIGURAÇÕES */}
        {activeTab === 'configuracoes' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Configurações do Sistema
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Configure parâmetros globais do sistema
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Funcionalidade em Desenvolvimento
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Em breve você poderá configurar parâmetros globais do sistema, como configurações de email, notificações, etc.
              </p>
            </div>
          </div>
        )}

      </main>

      <Toaster position="top-right" />
    </div>
  );
}