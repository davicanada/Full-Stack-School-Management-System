'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario, Institution } from '@/types';
import toast from 'react-hot-toast';

interface Stats {
  totalTurmas: number;
  totalAlunos: number;
  totalProfessores: number;
  ocorrenciasEsteMs: number;
  solicitacoesPendentes: number;
}


export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<Usuario | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [userInstitutions, setUserInstitutions] = useState<Institution[]>([]);
  const [showInstitutionDropdown, setShowInstitutionDropdown] = useState(false);
  const [activeRole, setActiveRole] = useState<string>('admin');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalTurmas: 0,
    totalAlunos: 0,
    totalProfessores: 0,
    ocorrenciasEsteMs: 0,
    solicitacoesPendentes: 0
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  const checkAvailableRoles = useCallback(async (userId: string, institutionId: string): Promise<string[]> => {
    try {
      console.log('🎭 Verificando roles disponíveis para:', { userId, institutionId });
      const roles: string[] = [];

      // Verificar role principal do usuário se tem institution_id matching
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData.institution_id === institutionId && userData.role) {
          roles.push(userData.role);
          console.log('✅ Role principal encontrado:', userData.role);
        }
      }

      // Buscar roles em user_institutions para esta instituição específica
      const { data: userInstData, error } = await supabase
        .from('user_institutions')
        .select('role')
        .eq('user_id', userId)
        .eq('institution_id', institutionId);

      if (!error && userInstData) {
        userInstData.forEach((ui: { role: string }) => {
          if (ui.role && !roles.includes(ui.role)) {
            roles.push(ui.role);
            console.log('✅ Role adicional encontrado:', ui.role);
          }
        });
      } else if (error) {
        console.error('❌ Erro ao buscar roles em user_institutions:', error);
      }

      console.log('🎭 Roles totais encontrados na instituição:', roles);
      return roles;
    } catch (error) {
      console.error('❌ Erro ao verificar roles disponíveis:', error);
      return [];
    }
  }, []);

  const fetchStats = useCallback(async (institutionId: string) => {
    // Evitar múltiplas chamadas simultâneas
    if (statsLoading) {
      console.log('⏳ Estatísticas já estão sendo carregadas, ignorando nova chamada');
      return;
    }
    
    try {
      console.log('📊 Carregando estatísticas para instituição:', institutionId);
      setStatsLoading(true);
      
      if (!institutionId) {
        console.error('❌ ID da instituição é necessário para carregar estatísticas');
        setStatsLoading(false);
        return;
      }
      
      // Calcular início do mês atual
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      console.log('📅 Período para ocorrências:', { startOfMonth, now: now.toISOString() });

      // Buscar contadores com as consultas corretas
      const [turmasResult, alunosResult, professoresResult, ocorrenciasResult, solicitacoesResult] = await Promise.all([
        // Total de Turmas ativas (não na lixeira e ativas)
        supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .eq('is_active', true)
          .is('deleted_at', null),
        
        // Total de Alunos com turma válida
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .not('class_id', 'is', null),
        
        // Total de Professores
        supabase
          .from('user_institutions')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .eq('role', 'professor'),
        
        // Ocorrências deste mês
        supabase
          .from('occurrences')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .gte('occurred_at', startOfMonth),
        
        // Solicitações de professores pendentes
        supabase
          .from('access_requests')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .eq('request_type', 'professor')
          .eq('status', 'pending')
      ]);

      console.log('📊 Resultados dos contadores:');
      console.log('Total de turmas ativas:', turmasResult.count || 0);
      console.log('Total de alunos com turma:', alunosResult.count || 0);
      console.log('Total de professores:', professoresResult.count || 0);
      console.log('Ocorrências este mês:', ocorrenciasResult.count || 0);
      console.log('Solicitações pendentes:', solicitacoesResult.count || 0);
      
      setStats({
        totalTurmas: turmasResult.count || 0,
        totalAlunos: alunosResult.count || 0,
        totalProfessores: professoresResult.count || 0,
        ocorrenciasEsteMs: ocorrenciasResult.count || 0,
        solicitacoesPendentes: solicitacoesResult.count || 0
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setStatsLoading(false);
    }
  }, [statsLoading]);

  useEffect(() => {
    const loadUserInstitutions = async (userId: string, userData?: Usuario) => {
      try {
        console.log('🏫 Carregando instituições do usuário:', userId);
        const userInstitutionsData: Institution[] = [];
        
        // Usar userData passado como parâmetro ou o estado atual do user
        const currentUser = userData || user;
        
        // Buscar instituições através de institution_id (método antigo)
        if (currentUser?.institution_id) {
          console.log('📍 Buscando instituição direta:', currentUser.institution_id);
          const { data: directInstitution, error: directError } = await supabase
            .from('institutions')
            .select('*')
            .eq('id', currentUser.institution_id)
            .single();
          
          if (!directError && directInstitution) {
            console.log('✅ Instituição direta encontrada:', directInstitution.nome);
            userInstitutionsData.push(directInstitution);
          } else if (directError) {
            console.log('ℹ️ Instituição direta não encontrada:', directError.message);
          }
        }
        
        // Buscar também por user_institutions (método novo)
        const { data: userInstData, error: userInstError } = await supabase
          .from('user_institutions')
          .select(`
            institutions!inner(
              id,
              name,
              address,
              city,
              state,
              created_at
            )
          `)
          .eq('user_id', userId);
        
        if (!userInstError && userInstData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const additionalInstitutions = userInstData.map((ui: any) => ({
            id: ui.institutions.id,
            nome: ui.institutions.name || ui.institutions.nome,
            endereco: ui.institutions.address,
            cidade: ui.institutions.city,
            estado: ui.institutions.state,
            ativa: true,
            created_at: ui.institutions.created_at,
          } as Institution));
          // Evitar duplicatas
          additionalInstitutions.forEach((inst: Institution) => {
            if (!userInstitutionsData.find(existing => existing.id === inst.id)) {
              userInstitutionsData.push(inst);
            }
          });
        }
        
        setUserInstitutions(userInstitutionsData);
        
        // Se não tem instituição ativa, definir a primeira
        if (userInstitutionsData.length > 0 && !localStorage.getItem('activeInstitution')) {
          const firstInstitution = userInstitutionsData[0];
          setInstitution(firstInstitution);
          localStorage.setItem('activeInstitution', JSON.stringify(firstInstitution));
          localStorage.setItem('allUserInstitutions', JSON.stringify(userInstitutionsData));
          await fetchStats(firstInstitution.id);
          
          // Verificar roles disponíveis na primeira instituição
          if (userData || user) {
            const roles = await checkAvailableRoles((userData || user)!.id, firstInstitution.id);
            setAvailableRoles(roles);
            
            // Definir role ativo baseado no localStorage ou padrão
            const storedActiveRole = localStorage.getItem('activeRole');
            if (storedActiveRole && roles.includes(storedActiveRole)) {
              setActiveRole(storedActiveRole);
            } else if (roles.includes('admin')) {
              setActiveRole('admin');
              localStorage.setItem('activeRole', 'admin');
            } else if (roles.includes('professor')) {
              setActiveRole('professor');
              localStorage.setItem('activeRole', 'professor');
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar instituições do usuário:', error);
        toast.error('Erro ao carregar instituições');
      }
    };

    const checkAuth = async () => {
      try {
        console.log('🔍 Iniciando verificação de autenticação...');
        
        const storedUser = localStorage.getItem('user');
        const storedActiveInstitution = localStorage.getItem('activeInstitution');
        const storedAllInstitutions = localStorage.getItem('allUserInstitutions');
        
        console.log('📦 Dados do localStorage:', {
          hasUser: !!storedUser,
          hasActiveInstitution: !!storedActiveInstitution,
          hasAllInstitutions: !!storedAllInstitutions
        });
        
        if (!storedUser) {
          console.log('❌ Usuário não encontrado no localStorage');
          router.push('/');
          return;
        }

        let userData;
        try {
          userData = JSON.parse(storedUser);
          console.log('✅ Dados do usuário parseados:', userData);
        } catch (parseError) {
          console.error('❌ Erro ao fazer parse dos dados do usuário:', parseError);
          localStorage.removeItem('user');
          router.push('/');
          return;
        }
        
        if (!userData || !userData.role || userData.role !== 'admin') {
          console.log('❌ Usuário inválido ou não é admin:', userData);
          toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
          router.push('/');
          return;
        }

        setUser(userData);

        // Verificar se tem instituição ativa selecionada
        if (storedActiveInstitution) {
          let activeInstitution;
          try {
            activeInstitution = JSON.parse(storedActiveInstitution);
            console.log('🏢 Instituição ativa carregada:', activeInstitution?.nome);
          } catch (parseError) {
            console.error('❌ Erro ao fazer parse da instituição ativa:', parseError);
            localStorage.removeItem('activeInstitution');
            await loadUserInstitutions(userData.id, userData);
            return;
          }
          
          if (activeInstitution?.id) {
            setInstitution(activeInstitution);
            
            // Carregar todas as instituições do usuário se disponível
            if (storedAllInstitutions) {
              try {
                const allInstitutions = JSON.parse(storedAllInstitutions);
                console.log('📋 Todas as instituições carregadas:', allInstitutions?.length);
                if (Array.isArray(allInstitutions)) {
                  setUserInstitutions(allInstitutions);
                } else {
                  console.log('⚠️ Dados de instituições inválidos, buscando no banco');
                  await loadUserInstitutions(userData.id, userData);
                }
              } catch (parseError) {
                console.error('❌ Erro ao fazer parse das instituições:', parseError);
                localStorage.removeItem('allUserInstitutions');
                await loadUserInstitutions(userData.id, userData);
              }
            } else {
              // Se não tem todas, buscar no banco
              await loadUserInstitutions(userData.id, userData);
            }
            
            if (activeInstitution?.id) {
              await fetchStats(activeInstitution.id);
              
              // Verificar roles disponíveis na instituição atual
              const roles = await checkAvailableRoles(userData.id, activeInstitution.id);
              setAvailableRoles(roles);
              
              // Definir role ativo baseado no localStorage ou padrão
              const storedActiveRole = localStorage.getItem('activeRole');
              if (storedActiveRole && roles.includes(storedActiveRole)) {
                setActiveRole(storedActiveRole);
              } else if (roles.includes('admin')) {
                setActiveRole('admin');
                localStorage.setItem('activeRole', 'admin');
              } else if (roles.includes('professor')) {
                setActiveRole('professor');
                localStorage.setItem('activeRole', 'professor');
              }
            }
          } else {
            console.log('⚠️ Instituição ativa sem ID válido');
            await loadUserInstitutions(userData.id, userData);
          }
        } else {
          // Se não tem instituição ativa, buscar e definir
          console.log('ℹ️ Nenhuma instituição ativa, carregando do banco');
          await loadUserInstitutions(userData.id, userData);
        }
      } catch (error) {
        console.error('Erro na autenticação:', error);
        toast.error('Erro ao verificar autenticação');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showInstitutionDropdown && !(event.target as Element).closest('.institution-dropdown')) {
        setShowInstitutionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showInstitutionDropdown]);

  // Fechar role dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showRoleDropdown && !(event.target as Element).closest('.role-dropdown')) {
        setShowRoleDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRoleDropdown]);

  

  const handleInstitutionSwitch = async (newInstitution: Institution) => {
    try {
      console.log('🔄 Trocando para instituição:', newInstitution?.nome);
      
      if (!newInstitution?.id) {
        console.error('❌ Instituição inválida para troca');
        toast.error('Instituição inválida');
        return;
      }
      
      setInstitution(newInstitution);
      
      try {
        localStorage.setItem('activeInstitution', JSON.stringify(newInstitution));
      } catch (storageError) {
        console.error('❌ Erro ao salvar instituição no localStorage:', storageError);
      }
      
      setShowInstitutionDropdown(false);
      
      // Recarregar estatísticas da nova instituição
      await fetchStats(newInstitution.id);
      
      // Verificar roles disponíveis na nova instituição
      if (!user) {
        toast.error('Erro: usuário não encontrado');
        return;
      }
      const roles = await checkAvailableRoles(user.id, newInstitution.id);
      setAvailableRoles(roles);
      
      // Resetar role ativo para admin se disponível, senão o primeiro role disponível
      if (roles.includes('admin')) {
        setActiveRole('admin');
        localStorage.setItem('activeRole', 'admin');
      } else if (roles.includes('professor')) {
        setActiveRole('professor');
        localStorage.setItem('activeRole', 'professor');
      }
      
      toast.success(`Trocado para: ${newInstitution.nome}`);
    } catch (error) {
      console.error('Erro ao trocar instituição:', error);
      toast.error('Erro ao trocar instituição');
    }
  };

  const handleRoleSwitch = (newRole: string) => {
    try {
      console.log('🎭 Trocando para role:', newRole);
      
      if (!availableRoles.includes(newRole)) {
        console.error('❌ Role não disponível:', newRole);
        toast.error('Papel não disponível');
        return;
      }
      
      setActiveRole(newRole);
      localStorage.setItem('activeRole', newRole);
      setShowRoleDropdown(false);
      
      // Redirect based on role
      if (newRole === 'professor') {
        router.push('/professor');
        return;
      }
      
      toast.success(`Trocado para: ${newRole === 'admin' ? 'Administrador' : 'Professor'}`);
    } catch (error) {
      console.error('Erro ao trocar role:', error);
      toast.error('Erro ao trocar papel');
    }
  };

    
    

  const handleLogout = () => {
    try {
      localStorage.removeItem('user');
      toast.success('Logout realizado com sucesso');
      router.push('/');
    } catch {
      toast.error('Erro ao fazer logout');
    }
  };

  const cleanupOrphanedStudents = async () => {
    if (!institution?.id) return;
    
    try {
      // Buscar alunos órfãos (sem turma válida)
      const { data: orphanedStudents, error: orphanError } = await supabase
        .from('students')
        .select('id, name, class_id')
        .eq('institution_id', institution.id)
        .is('class_id', null);
      
      if (orphanError) {
        console.error('Erro ao buscar alunos órfãos:', orphanError);
        return;
      }
      
      console.log('🧹 Alunos órfãos encontrados:', orphanedStudents?.length || 0);
      
      if (orphanedStudents && orphanedStudents.length > 0) {
        const confirmed = window.confirm(
          `Encontrados ${orphanedStudents.length} aluno(s) sem turma válida.\n\n` +
          `Deseja removê-los da base de dados?\n\n` +
          `Esta ação não pode ser desfeita.`
        );
        
        if (confirmed) {
          const studentIds = orphanedStudents.map(s => s.id);
          const { error: deleteError } = await supabase
            .from('students')
            .delete()
            .in('id', studentIds);
          
          if (deleteError) {
            console.error('Erro ao deletar alunos órfãos:', deleteError);
            toast.error('Erro ao limpar alunos órfãos');
          } else {
            toast.success(`${orphanedStudents.length} aluno(s) órfão(s) removido(s)`);
            await fetchStats(institution.id);
          }
        }
      } else {
        toast.success('Nenhum aluno órfão encontrado');
      }
    } catch (error) {
      console.error('Erro na limpeza de alunos órfãos:', error);
      toast.error('Erro ao limpar dados');
    }
  };

  const handleCardClick = (feature: string) => {
    if (feature === 'Gerenciar Turmas') {
      router.push('/admin/turmas');
      return;
    }
    
    if (feature === 'Gerenciar Alunos') {
      router.push('/admin/alunos');
      return;
    }
    
    if (feature === 'Tipos de Ocorrências') {
      router.push('/admin/tipos-ocorrencias');
      return;
    }
    
    if (feature === 'Gerenciar Professores') {
      router.push('/admin/professores');
      return;
    }
    
    if (feature === 'Solicitações de Professores') {
      router.push('/admin/professores?tab=pending');
      return;
    }
    
    if (feature === 'Limpar Dados') {
      cleanupOrphanedStudents();
      return;
    }
    
    if (feature === 'Dashboard de Ocorrências') {
      router.push('/admin/dashboard');
      return;
    }
    
    toast(`${feature} em desenvolvimento`, { icon: '🚧' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !institution) {
    return null;
  }

  const academicCards = [
    {
      icon: '👥',
      title: 'Gerenciar Turmas',
      description: 'Criar e organizar turmas',
      feature: 'Gerenciar Turmas'
    },
    {
      icon: '🎓',
      title: 'Gerenciar Alunos',
      description: 'Cadastrar e editar alunos',
      feature: 'Gerenciar Alunos'
    },
    {
      icon: '📝',
      title: 'Tipos de Ocorrências',
      description: 'Definir tipos de ocorrências',
      feature: 'Tipos de Ocorrências'
    }
  ];

  const staffCards = [
    {
      icon: '👨‍🏫',
      title: 'Gerenciar Professores',
      description: 'Aprovar e gerenciar professores',
      feature: 'Gerenciar Professores'
    },
    {
      icon: '✅',
      title: 'Solicitações de Professores',
      description: 'Aprovar novas solicitações',
      feature: 'Solicitações de Professores',
      badge: stats.solicitacoesPendentes
    }
  ];

  const analyticsCards = [
    {
      icon: '📊',
      title: 'Dashboard de Ocorrências',
      description: 'Visualizar estatísticas',
      feature: 'Dashboard de Ocorrências'
    },
    {
      icon: '📋',
      title: 'Relatórios',
      description: 'Gerar relatórios detalhados',
      feature: 'Relatórios'
    },
    {
      icon: '🧹',
      title: 'Limpar Dados',
      description: 'Remover alunos órfãos (sem turma)',
      feature: 'Limpar Dados'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold">Painel do Administrador</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-blue-50 font-semibold text-base">{institution?.nome || institution?.name || 'Carregando...'}</p>
                </div>
                {userInstitutions.length > 1 && (
                  <div className="relative institution-dropdown">
                    <button
                      onClick={() => setShowInstitutionDropdown(!showInstitutionDropdown)}
                      className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
                      title="Trocar instituição"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Trocar
                    </button>
                    
                    {showInstitutionDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        {userInstitutions.map((inst) => (
                          <button
                            key={inst.id}
                            onClick={() => handleInstitutionSwitch(inst)}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              institution?.id === inst.id 
                                ? 'bg-blue-50 text-blue-600 font-medium' 
                                : 'text-gray-700'
                            }`}
                          >
                            <div>
                              <div className="font-medium">{inst.nome}</div>
                              <div className="text-xs text-gray-500">{inst.cidade} - {inst.estado}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Role Switching Dropdown */}
                {availableRoles.length > 1 && (
                  <div className="relative role-dropdown">
                    <button
                      onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                      className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
                      title="Trocar papel"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {activeRole === 'admin' ? 'Admin' : 'Professor'}
                    </button>
                    
                    {showRoleDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        {availableRoles.map((role) => (
                          <button
                            key={role}
                            onClick={() => handleRoleSwitch(role)}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                              activeRole === role 
                                ? 'bg-blue-50 text-blue-600 font-medium' 
                                : 'text-gray-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                role === 'admin' ? 'bg-purple-500' : 'bg-orange-500'
                              }`}></div>
                              <span>
                                {role === 'admin' ? 'Administrador' : 'Professor'}
                              </span>
                              {activeRole === role && (
                                <svg className="w-4 h-4 ml-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-blue-100">Bem-vindo, {user.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Turmas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats.totalTurmas}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <span className="text-2xl">🎓</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Alunos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats.totalAlunos}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <span className="text-2xl">👨‍🏫</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Professores</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats.totalProfessores}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-full">
                <span className="text-2xl">📝</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ocorrências Este Mês</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats.ocorrenciasEsteMs}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">GESTÃO ACADÊMICA</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {academicCards.map((card, index) => (
                <div
                  key={index}
                  onClick={() => handleCardClick(card.feature)}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer group"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">
                      {card.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {card.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">GESTÃO DE EQUIPE</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {staffCards.map((card, index) => (
                <div
                  key={index}
                  onClick={() => handleCardClick(card.feature)}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer group"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">
                      {card.icon}
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {card.title}
                      </h3>
                      {card.badge !== undefined && card.badge > 0 && (
                        <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">ANÁLISES</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analyticsCards.map((card, index) => (
                <div
                  key={index}
                  onClick={() => handleCardClick(card.feature)}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer group"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">
                      {card.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {card.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}