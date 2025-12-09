'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario, Institution } from '@/types';
import toast, { Toaster } from 'react-hot-toast';

interface Teacher {
  id: string;
  name: string;
  email: string;
  created_at: string;
  is_active: boolean;
  userInstitutionId?: string; // ID do user_institutions para delete
  classCount?: number;
  occurrenceCount?: number;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

interface PendingRequest {
  id: string;
  name: string;
  email: string;
  created_at: string;
  status: string;
}

type ActiveTab = 'active' | 'pending' | 'trash';

export default function TeacheresPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<Usuario | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [trashedTeachers, setTrashedTeachers] = useState<Teacher[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para ordenação
  const [orderBy, setOrderBy] = useState<'name' | 'email' | 'created_at' | 'status'>('name');
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc');
  
  // States para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // States para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const fetchTeachers = useCallback(async (institutionId: string) => {
      console.log('🔍 Searching for teachers for institution:', institutionId);

      try {
        // Fetch teachers through user_institutions table (EXCLUDING trash)
        const { data: userInstitutions, error } = await supabase
          .from('user_institutions')
          .select(`
            id,
            role,
            users!inner (
              id,
              name,
              email,
              created_at,
              is_active,
              deleted_at,
              deleted_by
            )
          `)
          .eq('institution_id', institutionId)
          .eq('role', 'professor')
          .is('users.deleted_at', null);

        if (error) {
          console.error('Specific error fetching teachers:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          toast.error(`Error loading teachers: ${error.message}`);
          return;
        }

        console.log('Teachers found:', userInstitutions?.length || 0);

        // Count classes and occurrences for each teacher
        const teachersWithCounts = await Promise.all(
          (userInstitutions || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((ui: any) => ui.users) // Filter valid results
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map(async (ui: any) => {
              const teacher = ui.users;

              try {
                // Count classes where teacher is responsible
                const { count: classCount } = await supabase
                  .from('classes')
                  .select('*', { count: 'exact', head: true })
                  .eq('teacher_id', teacher.id)
                  .eq('institution_id', institutionId);

                // Count occurrences recorded by teacher
                const { count: occurrenceCount } = await supabase
                  .from('occurrences')
                  .select('*', { count: 'exact', head: true })
                  .eq('recorded_by', teacher.id)
                  .eq('institution_id', institutionId);

                return {
                  ...teacher,
                  userInstitutionId: ui.id, // Add user_institutions ID for delete
                  classCount: classCount || 0,
                  occurrenceCount: occurrenceCount || 0
                };
              } catch (countError) {
                console.warn('Error counting teacher data', teacher.name, countError);
                return {
                  ...teacher,
                  userInstitutionId: ui.id, // Add user_institutions ID for delete
                  classCount: 0,
                  occurrenceCount: 0
                };
              }
            })
        );

        console.log('Teachers processed:', teachersWithCounts.length);
        setTeachers(teachersWithCounts);
      } catch (error: unknown) {
        console.error('Exception error fetching teachers:', error);
        toast.error('Unexpected error loading teachers');
      }
    }, []);

  const fetchPendingRequests = useCallback(async (institutionId: string) => {
      console.log('Buscando solicitações para instituição:', institutionId);
      
      try {
        if (!institutionId) {
          console.warn('Institution ID é inválido');
          setPendingRequests([]);
          return;
        }

        const { data, error } = await supabase
          .from('access_requests')
          .select('id, name, email, created_at, status')
          .eq('institution_id', institutionId)
          .eq('request_type', 'professor')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error buscar solicitações:', error);
          
          // Verificar códigos de erro específicos
          if (error.code === '42P01') {
            toast.error('Tabela access_requests não existe');
          } else if (error.code === '42703') {
            toast.error('Campo não encontrado na tabela access_requests');
          } else {
            toast.error(`Error carregar solicitações: ${error.message}`);
          }
          
          setPendingRequests([]);
          return;
        }

        console.log('✅ Requests encontradas:', data?.length || 0);
        setPendingRequests(data || []);
      } catch (error: unknown) {
        console.error('❌ EXCEÇÃO CRÍTICA ao buscar solicitações:', error);
        
        // Definir array vazio para não quebrar a interface
        setPendingRequests([]);
        
        // Mostrar erro mais específico - APENAS UMA VEZ
        if (error instanceof Error && error.message && error.message.includes('relation "access_requests" does not exist')) {
          console.error('Tabela access_requests não existe no banco de dados');
          // No mostrar toast aqui para evitar duplicação
        } else if (error instanceof Error) {
          console.error('Erro inesperado:', error.message);
          // No mostrar toast aqui para evitar duplicação
        }
      }
    }, []);

  const fetchTrashedTeachers = useCallback(async (institutionId: string) => {
      console.log('🗑️ Buscando professores na lixeira para instituição:', institutionId);

      try {
        // Search professores na lixeira através da tabela user_institutions
        const { data: userInstitutions, error } = await supabase
          .from('user_institutions')
          .select(`
            id,
            role,
            users!inner (
              id,
              name,
              email,
              created_at,
              is_active,
              deleted_at,
              deleted_by
            )
          `)
          .eq('institution_id', institutionId)
          .eq('role', 'professor')
          .not('users.deleted_at', 'is', null);

        if (error) {
          console.error('Error buscar professores na lixeira:', error);
          toast.error(`Error carregar lixeira: ${error.message}`);
          return;
        }

        console.log('Teacheres na lixeira encontrados:', userInstitutions?.length || 0);

        // Contar turmas e ocorrências para cada professor na lixeira
        const trashedWithCounts = await Promise.all(
          (userInstitutions || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((ui: any) => ui.users)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map(async (ui: any) => {
              const teacher = ui.users;

              try {
                const { count: classCount } = await supabase
                  .from('classes')
                  .select('*', { count: 'exact', head: true })
                  .eq('teacher_id', teacher.id)
                  .eq('institution_id', institutionId);

                const { count: occurrenceCount } = await supabase
                  .from('occurrences')
                  .select('*', { count: 'exact', head: true })
                  .eq('recorded_by', teacher.id)
                  .eq('institution_id', institutionId);

                return {
                  ...teacher,
                  userInstitutionId: ui.id,
                  classCount: classCount || 0,
                  occurrenceCount: occurrenceCount || 0
                };
              } catch (countError) {
                console.warn('Error contar dados do professor na lixeira', teacher.name, countError);
                return {
                  ...teacher,
                  userInstitutionId: ui.id,
                  classCount: 0,
                  occurrenceCount: 0
                };
              }
            })
        );

        console.log('Teacheres na lixeira processados:', trashedWithCounts.length);
        setTrashedTeachers(trashedWithCounts);
      } catch (error: unknown) {
        console.error('Error buscar professores na lixeira:', error);
        toast.error('Erro inesperado ao carregar lixeira');
      }
    }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        
        if (!storedUser) {
          router.push('/');
          return;
        }

        const userDate = JSON.parse(storedUser);
        
        if (!userDate || userDate.role !== 'admin') {
          toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
          router.push('/');
          return;
        }

        setUser(userDate);
        console.log('User autenticado:', userDate);

        const { data: institutionDate, error: institutionError } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', userDate.institution_id)
          .single();

        if (institutionError) {
          console.error('Error carregar instituição:', institutionError);
          toast.error('Error carregar dados da instituição');
        } else {
          setInstitution(institutionDate);
          console.log('Institution carregada:', institutionDate);
        }

        console.log('Iniciando carregamento de professores, lixeira e solicitações...');
        await Promise.all([
          fetchTeachers(userDate.institution_id),
          fetchTrashedTeachers(userDate.institution_id),
          fetchPendingRequests(userDate.institution_id)
        ]);
        console.log('Carregamento concluído');
      } catch (error) {
        console.error('Erro na autenticação:', error);
        toast.error('Error verificar autenticação');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, fetchTeachers, fetchTrashedTeachers, fetchPendingRequests]);

  useEffect(() => {
    // Verificar se deve abrir na aba de solicitações pendentes
    const tab = searchParams.get('tab');
    if (tab === 'pending') {
      setActiveTab('pending');
    }
  }, [searchParams]);

  


  const handleApproveTeacher = async (request: PendingRequest) => {
    if (!user) return;

    const confirmed = window.confirm(`Approve solicitação de ${request.name}?`);
    if (!confirmed) return;

    console.log('🟡 INICIANDO APROVAÇÃO DE PROFESSOR');
    console.log('Request:', request);
    console.log('User aprovador:', user);

    try {
      // 🔍 Primeiro buscar os dados completos da solicitação incluindo institution_id
      console.log('📋 Buscando dados completos da solicitação...');
      const { data: fullRequest, error: requestError } = await supabase
        .from('access_requests')
        .select('*')
        .eq('id', request.id)
        .single();

      if (requestError) {
        console.error('❌ Error buscar dados da solicitação:', requestError);
        toast.error('Error buscar dados da solicitação');
        return;
      }

      if (!fullRequest.institution_id) {
        console.error('❌ Erro: Request sem institution_id');
        toast.error('Erro: Request não possui instituição definida');
        return;
      }

      console.log('🏢 Institution ID da solicitação:', fullRequest.institution_id);
      console.log('fullRequest:', fullRequest);
      console.log('fullRequest.institution_id:', fullRequest.institution_id);
      console.log('fullRequest.email:', fullRequest.email);
      console.log('fullRequest.name:', fullRequest.name);
      
      // SIMPLIFICADO: Sempre criar novo usuário (1 email = 1 usuário)
      console.log('🆕 Criando novo usuário professor para email:', fullRequest.email);
      console.log('Criando usuário COM institution_id (sistema consistente)');
      
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([
          {
            name: fullRequest.name,
            email: fullRequest.email,
            role: 'professor',
            password_hash: 'senha123',
            is_active: true,
            institution_id: fullRequest.institution_id  // ADICIONADO DE VOLTA para consistência
          }
        ])
        .select()
        .single();

      if (userError) {
        console.error('❌ Error criar usuário:', userError);
        toast.error(`Error criar professor: ${userError.message}`);
        return;
      }

      console.log('✅ New usuário created successfully:', newUser);
      console.log('1. User criado:', newUser);
      console.log('2. ID do usuário:', newUser?.id);
      console.log('3. Institution ID:', fullRequest.institution_id);
      console.log('Type de newUser:', typeof newUser);
      console.log('É array?', Array.isArray(newUser));
      console.log('newUser completo:', JSON.stringify(newUser, null, 2));
      
      // Extrair userId com segurança (pode vir como array ou objeto)
      const userId = Array.isArray(newUser) ? newUser[0]?.id : newUser?.id;
      console.log('4. userId extraído:', userId);

      // Verificação de segurança
      if (!userId) {
        console.error('ERRO: ID do usuário não encontrado!');
        console.error('newUser recebido:', newUser);
        toast.error('Error criar vínculo - ID do usuário não encontrado');
        return;
      }

      // SIMPLIFICADO: Como é usuário novo, pode prosseguir diretamente
      console.log('✅ User novo, criando vínculo com a instituição');

      // Create vínculo professor com a instituição (para consistência futura)
      console.log('🔗 Criando vínculo professor com instituição:', fullRequest.institution_id);
      console.log('Teacher tem institution_id direto + vínculo em user_institutions para consistência:', {
        user_id: userId,
        institution_id: fullRequest.institution_id,
        role: 'professor'
      });
      
      const { data: linkDate, error: linkError } = await supabase
        .from('user_institutions')
        .insert({
          user_id: userId,
          institution_id: fullRequest.institution_id,
          role: 'professor'
        })
        .select();
      
      console.log('5. Resultado do insert:', { linkDate, linkError });
      
      if (linkError) {
        console.error('ERRO ao criar vínculo:', linkError);
        console.error('Código do erro:', linkError.code);
        console.error('Mensagem do erro:', linkError.message);
        console.error('Details do erro:', linkError.details);
        console.error('Hint do erro:', linkError.hint);
        toast.error('Error criar vínculo: ' + linkError.message);
        return;
      }
      
      console.log('✅ Teacher vinculado à instituição com sucesso');
      console.log('6. Dados do vínculo criado:', linkDate);

      // Verificar se o vínculo foi criado
      const { data: checkLink, error: checkError } = await supabase
        .from('user_institutions')
        .select('*')
        .eq('user_id', userId)
        .eq('institution_id', fullRequest.institution_id)
        .single();
      
      console.log('7. Verificação do vínculo criado:', checkLink);
      console.log('8. Erro na verificação (se houver):', checkError);

      // Update status da solicitação
      console.log('🔄 Atualizando status da solicitação...');
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('❌ Error atualizar solicitação:', updateError);
        console.error('Código do erro:', updateError.code);
        console.error('Mensagem do erro:', updateError.message);
        
        if (updateError.code === '42501') {
          toast.error('Erro de permissão: Verifique políticas RLS na tabela access_requests');
        } else {
          toast.error(`Error atualizar solicitação: ${updateError.message}`);
        }
        return;
      }

      console.log('✅ APROVAÇÃO CONCLUÍDA COM SUCESSO!');
      toast.success('Teacher approved successfully!');
      
      // Recarregar dados sequencialmente para evitar sobrecarga
      try {
        console.log('🔄 Recarregando dados...');
        if (user.institution_id) {
          if (user.institution_id) await fetchTeachers(user.institution_id);
          await fetchPendingRequests(user.institution_id);
        }
        console.log('✅ Dados recarregados com sucesso');
      } catch (refreshError) {
        console.warn('Error recarregar dados após aprovação:', refreshError);
      }
    } catch (error) {
      console.error('❌ ERRO CRÍTICO ao aprovar professor:', error);
      toast.error('Erro crítico ao aprovar professor');
    }
  };

  const handleRejectTeacher = async (request: PendingRequest) => {
    if (!user) return;

    const confirmed = window.confirm(`Reject solicitação de ${request.name}?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('access_requests')
        .update({ 
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: user.id
        })
        .eq('id', request.id);

      if (error) {
        console.error('Error rejeitar solicitação:', error);
        toast.error('Error rejeitar solicitação');
        return;
      }

      toast.success('Request rejeitada');
      if (user.institution_id) await fetchPendingRequests(user.institution_id);
    } catch (error) {
      console.error('Error rejeitar solicitação:', error);
      toast.error('Error rejeitar solicitação');
    }
  };


  const handleMoveToTrash = async (teacher: Teacher) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Are you sure you want to mover ${teacher.name} para a lixeira?\n\n` +
      `O professor será desativado automaticamente e poderá ser restaurado depois.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          is_active: false
        })
        .eq('id', teacher.id);

      if (error) {
        console.error('Error mover professor para lixeira:', error);
        toast.error('Error mover para lixeira');
        return;
      }

      toast.success(`${teacher.name} foi movido para a lixeira e desativado`);
      if (user.institution_id) {
        await fetchTeachers(user.institution_id);
        await fetchTrashedTeachers(user.institution_id);
      }
    } catch (error) {
      console.error('Error mover professor para lixeira:', error);
      toast.error('Error mover para lixeira');
    }
  };

  const handleRestoreFromTrash = async (teacher: Teacher) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Restore ${teacher.name} da lixeira?\n\n` +
      `O professor será reativado automaticamente.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          deleted_at: null,
          deleted_by: null,
          is_active: true
        })
        .eq('id', teacher.id);

      if (error) {
        console.error('Error restaurar professor:', error);
        toast.error('Error restaurar professor');
        return;
      }

      toast.success(`${teacher.name} foi restaurado e reativado com sucesso`);
      if (user.institution_id) {
        await fetchTeachers(user.institution_id);
        await fetchTrashedTeachers(user.institution_id);
      }
    } catch (error) {
      console.error('Error restaurar professor:', error);
      toast.error('Error restaurar professor');
    }
  };

  const handleRemoveFromInstitution = async (userId: string, userName: string) => {
    if (!user) return;

    const confirmDelete = window.confirm(
      `ATENÇÃO: Are you sure you want to EXCLUIR PERMANENTEMENTE ${userName}?\n\n` +
      `Esta ação NÃO PODE SER DESFEITA.`
    );

    if (!confirmDelete) return;

    try {
      // Verificar se tem ocorrências registradas
      const { data: occurrences, error: occurrencesError } = await supabase
        .from('occurrences')
        .select('id')
        .eq('teacher_id', userId);

      if (occurrencesError) throw occurrencesError;

      if (occurrences && occurrences.length > 0) {
        toast.error(`No é possível excluir. Existem ${occurrences.length} ocorrência(s) registrada(s) por este professor.`);
        return;
      }

      // Delete primeiro de user_institutions
      await supabase
        .from('user_institutions')
        .delete()
        .eq('user_id', userId);

      // Delete completamente de users
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast.success(`${userName} foi excluído permanentemente`);
      if (user.institution_id) {
        await fetchTeachers(user.institution_id);
        await fetchTrashedTeachers(user.institution_id);
      }
    } catch (error) {
      console.error('Error deletar professor:', error);
      toast.error('Error deletar professor');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Funções para ordenação
  const handleSort = (column: 'name' | 'email' | 'created_at' | 'status') => {
    if (orderBy === column) {
      setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(column);
      setOrderDirection('asc');
    }
    setCurrentPage(1); // Back para primeira página ao ordenar
  };

  const getSortIcon = (column: 'name' | 'email' | 'created_at' | 'status') => {
    if (orderBy !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return orderDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4l9 16 9-16H3z" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 20L12 4 3 20h18z" />
      </svg>
    );
  };

  // Funções para filtros e paginação
  const getFilteredAndSortedTeachers = () => {
    const filtered = teachers.filter(teacher => {
      const matchesSearch = teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           teacher.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'active' && teacher.is_active) ||
                           (statusFilter === 'inactive' && !teacher.is_active);
      return matchesSearch && matchesStatus;
    });
    
    // Ordenar
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (orderBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'status':
          aValue = a.is_active ? 1 : 0;
          bValue = b.is_active ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) {
        return orderDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return orderDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    return filtered;
  };

  const filteredTeachers = getFilteredAndSortedTeachers();
  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
  const paginatedTeachers = filteredTeachers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Contadores
  const activeTeachers = teachers.filter(t => t.is_active).length;
  const inactiveTeachers = teachers.filter(t => !t.is_active).length;

  // Function to limpar filtros
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  // Function to lidar com busca
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  // Function to lidar com filtro de status
  const handleStatusFilter = (filter: 'all' | 'active' | 'inactive') => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  // Function to mudar itens por página
  const changeItemsPerPage = () => {
    setCurrentPage(1);
    // Note: itemsPerPage is currently const, but we keep this function for interface compatibility
  };

  // Function to ir para página específica
  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !institution) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="bg-blue-700 hover:bg-blue-800 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <div>
                <h1 className="text-2xl font-bold">Gerenciar Teacheres</h1>
                <p className="text-blue-100">{institution.nome}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Teacheres Actives
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {teachers.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Requests Pendings
              {pendingRequests.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-800 py-0.5 px-2.5 rounded-full text-xs font-medium">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'trash'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🗑️ Trash
              {trashedTeachers.length > 0 && (
                <span className="ml-2 bg-orange-100 text-orange-800 py-0.5 px-2.5 rounded-full text-xs font-medium">
                  {trashedTeachers.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-blue-800">
              <strong>Deactivate:</strong> Mantém vínculo inativo | <strong>Remove:</strong> Remove da instituição
            </span>
          </div>
        </div>
        {activeTab === 'active' && (
          <div>
            {/* Seção de Filtros e Controles */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                {/* Busca */}
                <div className="flex-1 w-full lg:max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔍 Search Teacher
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Name ou email..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                    />
                  </div>
                </div>
                
                {/* Filtro de Status */}
                <div className="w-full lg:w-auto">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎯 Filter por Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                    className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                  >
                    <option value="all">Todos ({teachers.length})</option>
                    <option value="active">Actives ({activeTeachers})</option>
                    <option value="inactive">Inactives ({inactiveTeachers})</option>
                  </select>
                </div>
                
                {/* Botão Limpar Filtros */}
                <div className="w-full lg:w-auto flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-2 opacity-0">
                    Actions
                  </label>
                  <button
                    onClick={clearFilters}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2 w-full lg:w-auto justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Limpar Filtros
                  </button>
                </div>
              </div>
              
              {/* Contador de Resultados */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-blue-600">
                      Mostrando {Math.min(paginatedTeachers.length, itemsPerPage)} de {filteredTeachers.length} professores
                    </span>
                    {(searchTerm || statusFilter !== 'all') && (
                      <span className="text-gray-500 ml-2">
                        (filtrado de {teachers.length} total)
                      </span>
                    )}
                  </div>
                  
                  {/* Itens por página */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Itens por página:</span>
                    <select
                      value={itemsPerPage}
                      onChange={() => changeItemsPerPage()}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {filteredTeachers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum professor cadastrado ainda
                </h3>
                <p className="text-gray-500 mb-6">
                  Os professores aparecerão aqui após suas solicitações serem aprovadas
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors group ${
                            orderBy === 'name' ? 'text-blue-600 bg-blue-50' : 'text-gray-500'
                          }`}
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-2">
                            <span>Teacher</span>
                            <div className="flex flex-col">
                              {getSortIcon('name')}
                            </div>
                          </div>
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors group ${
                            orderBy === 'status' ? 'text-blue-600 bg-blue-50' : 'text-gray-500'
                          }`}
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-2">
                            <span>Status</span>
                            <div className="flex flex-col">
                              {getSortIcon('status')}
                            </div>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Classs
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Occurrences
                        </th>
                        <th 
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors group ${
                            orderBy === 'created_at' ? 'text-blue-600 bg-blue-50' : 'text-gray-500'
                          }`}
                          onClick={() => handleSort('created_at')}
                        >
                          <div className="flex items-center gap-2">
                            <span>Date de Entrada</span>
                            <div className="flex flex-col">
                              {getSortIcon('created_at')}
                            </div>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedTeachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                              <div className="text-sm text-gray-500">{teacher.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                teacher.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {teacher.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {teacher.classCount} turma(s)
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {teacher.occurrenceCount} ocorrência(s)
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(teacher.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              {/* Botão Trash - Admins e Master */}
                              <button
                                onClick={() => handleMoveToTrash(teacher)}
                                className="text-orange-600 hover:text-orange-900 transition-colors"
                                title="Mover para lixeira"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>

                              {/* Botão Delete Permanentemente - APENAS Master */}
                              {user.role === 'master' && (
                                <button
                                  onClick={() => handleRemoveFromInstitution(teacher.id, teacher.name)}
                                  className="text-red-600 hover:text-red-900 transition-colors"
                                  title="Delete PERMANENTEMENTE (apenas Master)"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Controles de Paginação */}
                {totalPages > 1 && (
                  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg shadow-sm">
                    {/* Versão Mobile */}
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => goToPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Anterior
                      </button>
                      <span className="text-sm text-gray-700 self-center">
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Próxima
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Versão Desktop */}
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Exibindo{' '}
                          <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> a{' '}
                          <span className="font-medium">
                            {Math.min(currentPage * itemsPerPage, filteredTeachers.length)}
                          </span>{' '}
                          de <span className="font-medium">{filteredTeachers.length}</span> professores
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {/* Botão Primeira */}
                        <button
                          onClick={() => goToPage(1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Primeira página"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                          </svg>
                        </button>
                        
                        {/* Botão Anterior */}
                        <button
                          onClick={() => goToPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {/* Números das páginas */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          if (totalPages <= 7 || 
                              page === 1 || 
                              page === totalPages || 
                              (page >= currentPage - 1 && page <= currentPage + 1)) {
                            return (
                              <button
                                key={page}
                                onClick={() => goToPage(page)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                                  page === currentPage
                                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600 font-semibold'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500">
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}
                        
                        {/* Botão Próxima */}
                        <button
                          onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {/* Botão Última */}
                        <button
                          onClick={() => goToPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Última página"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pending' && (
          <div>
            {pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No pending requests
                </h3>
                <p className="text-gray-500">
                  As solicitações de novos professores aparecerão aqui para aprovação
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Solicitante
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date da Request
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendingRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{request.name}</div>
                              <div className="text-sm text-gray-500">{request.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(request.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => handleApproveTeacher(request)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectTeacher(request)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                              >
                                Reject
                              </button>
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

        {activeTab === 'trash' && (
          <div>
            {/* Info sobre Trash */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-orange-800">
                  <strong>Trash:</strong> Teacheres removidos mas que podem ser restaurados.
                  {user.role === 'master' && <span className="ml-1">Como Master, você pode deletar permanentemente.</span>}
                </span>
              </div>
            </div>

            {trashedTeachers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Trash vazia
                </h3>
                <p className="text-gray-500">
                  Teacheres movidos para a lixeira aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Teacher
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Classs
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Occurrences
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Removido em
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {trashedTeachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                              <div className="text-sm text-gray-500">{teacher.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {teacher.classCount} turma(s)
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {teacher.occurrenceCount} ocorrência(s)
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {teacher.deleted_at ? formatDate(teacher.deleted_at) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              {/* Botão Restore - Todos podem usar */}
                              <button
                                onClick={() => handleRestoreFromTrash(teacher)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200 flex items-center gap-1"
                                title="Restore professor"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Restore
                              </button>

                              {/* Botão Delete Permanentemente - APENAS Master */}
                              {user.role === 'master' && (
                                <button
                                  onClick={() => handleRemoveFromInstitution(teacher.id, teacher.name)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200 flex items-center gap-1"
                                  title="Delete PERMANENTEMENTE"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  Delete
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
      </main>

      <Toaster position="top-right" />
    </div>
  );
}