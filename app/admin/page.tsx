'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario, Institution } from '@/types';
import toast from 'react-hot-toast';

interface Stats {
  totalClasss: number;
  totalStudents: number;
  totalTeacheres: number;
  ocorrenciasEsteMs: number;
  solicitacoesPendings: number;
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
    totalClasss: 0,
    totalStudents: 0,
    totalTeacheres: 0,
    ocorrenciasEsteMs: 0,
    solicitacoesPendings: 0
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  const checkAvailableRoles = useCallback(async (userId: string, institutionId: string): Promise<string[]> => {
    try {
      console.log('🎭 Checking available roles for:', { userId, institutionId });
      const roles: string[] = [];

      // Check user's main role if has matching institution_id
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userDate = JSON.parse(storedUser);
        if (userDate.institution_id === institutionId && userDate.role) {
          roles.push(userDate.role);
          console.log('✅ Main role found:', userDate.role);
        }
      }

      // Fetch roles from user_institutions for this specific institution
      const { data: userInstDate, error } = await supabase
        .from('user_institutions')
        .select('role')
        .eq('user_id', userId)
        .eq('institution_id', institutionId);

      if (!error && userInstDate) {
        userInstDate.forEach((ui: { role: string }) => {
          if (ui.role && !roles.includes(ui.role)) {
            roles.push(ui.role);
            console.log('✅ Additional role found:', ui.role);
          }
        });
      } else if (error) {
        console.error('❌ Error fetching roles from user_institutions:', error);
      }

      console.log('🎭 Total roles found in institution:', roles);
      return roles;
    } catch (error) {
      console.error('❌ Error checking available roles:', error);
      return [];
    }
  }, []);

  const fetchStats = useCallback(async (institutionId: string) => {
    // Evitar múltiplas chamadas simultâneas
    if (statsLoading) {
      console.log('⏳ Statistics já estão sendo carregadas, ignorando nova chamada');
      return;
    }
    
    try {
      console.log('📊 Loading estatísticas para instituição:', institutionId);
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

      // Search contadores com as consultas corretas
      const [turmasResult, alunosResult, professoresResult, ocorrenciasResult, solicitacoesResult] = await Promise.all([
        // Total Classs ativas (não na lixeira e ativas)
        supabase
          .from('classes')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .eq('is_active', true)
          .is('deleted_at', null),
        
        // Total Students com turma válida
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .not('class_id', 'is', null),
        
        // Total Teacheres
        supabase
          .from('user_institutions')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .eq('role', 'professor'),
        
        // Occurrences deste mês
        supabase
          .from('occurrences')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .gte('occurred_at', startOfMonth),
        
        // Requests de professores pendentes
        supabase
          .from('access_requests')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)
          .eq('request_type', 'professor')
          .eq('status', 'pending')
      ]);

      console.log('📊 Resultados dos contadores:');
      console.log('Total turmas ativas:', turmasResult.count || 0);
      console.log('Total alunos com turma:', alunosResult.count || 0);
      console.log('Total professores:', professoresResult.count || 0);
      console.log('Occurrences este mês:', ocorrenciasResult.count || 0);
      console.log('Requests pendentes:', solicitacoesResult.count || 0);
      
      setStats({
        totalClasss: turmasResult.count || 0,
        totalStudents: alunosResult.count || 0,
        totalTeacheres: professoresResult.count || 0,
        ocorrenciasEsteMs: ocorrenciasResult.count || 0,
        solicitacoesPendings: solicitacoesResult.count || 0
      });
    } catch (error) {
      console.error('Error buscar estatísticas:', error);
      toast.error('Error carregar estatísticas');
    } finally {
      setStatsLoading(false);
    }
  }, [statsLoading]);

  useEffect(() => {
    const loadUserInstitutions = async (userId: string, userDate?: Usuario) => {
      try {
        console.log('🏫 Loading instituições do usuário:', userId);
        const userInstitutionsDate: Institution[] = [];
        
        // Usar userDate passado como parâmetro ou o estado atual do user
        const currentUser = userDate || user;
        
        // Search instituições através de institution_id (método antigo)
        if (currentUser?.institution_id) {
          console.log('📍 Buscando instituição direta:', currentUser.institution_id);
          const { data: directInstitution, error: directError } = await supabase
            .from('institutions')
            .select('*')
            .eq('id', currentUser.institution_id)
            .single();
          
          if (!directError && directInstitution) {
            console.log('✅ Institution direta encontrada:', directInstitution.nome);
            userInstitutionsDate.push(directInstitution);
          } else if (directError) {
            console.log('ℹ️ Institution direta não encontrada:', directError.message);
          }
        }
        
        // Search também por user_institutions (método novo)
        const { data: userInstDate, error: userInstError } = await supabase
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
        
        if (!userInstError && userInstDate) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const additionalInstitutions = userInstDate.map((ui: any) => ({
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
            if (!userInstitutionsDate.find(existing => existing.id === inst.id)) {
              userInstitutionsDate.push(inst);
            }
          });
        }
        
        setUserInstitutions(userInstitutionsDate);
        
        // Se não tem instituição ativa, definir a primeira
        if (userInstitutionsDate.length > 0 && !localStorage.getItem('activeInstitution')) {
          const firstInstitution = userInstitutionsDate[0];
          setInstitution(firstInstitution);
          localStorage.setItem('activeInstitution', JSON.stringify(firstInstitution));
          localStorage.setItem('allUserInstitutions', JSON.stringify(userInstitutionsDate));
          await fetchStats(firstInstitution.id);
          
          // Verificar roles disponíveis na primeira instituição
          if (userDate || user) {
            const roles = await checkAvailableRoles((userDate || user)!.id, firstInstitution.id);
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
        console.error('Error carregar instituições do usuário:', error);
        toast.error('Error carregar instituições');
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
          console.log('❌ User não encontrado no localStorage');
          router.push('/');
          return;
        }

        let userDate;
        try {
          userDate = JSON.parse(storedUser);
          console.log('✅ Dados do usuário parseados:', userDate);
        } catch (parseError) {
          console.error('❌ Error fazer parse dos dados do usuário:', parseError);
          localStorage.removeItem('user');
          router.push('/');
          return;
        }
        
        if (!userDate || !userDate.role || userDate.role !== 'admin') {
          console.log('❌ User inválido ou não é admin:', userDate);
          toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
          router.push('/');
          return;
        }

        setUser(userDate);

        // Verificar se tem instituição ativa selecionada
        if (storedActiveInstitution) {
          let activeInstitution;
          try {
            activeInstitution = JSON.parse(storedActiveInstitution);
            console.log('🏢 Institution ativa carregada:', activeInstitution?.nome);
          } catch (parseError) {
            console.error('❌ Error fazer parse da instituição ativa:', parseError);
            localStorage.removeItem('activeInstitution');
            await loadUserInstitutions(userDate.id, userDate);
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
                  await loadUserInstitutions(userDate.id, userDate);
                }
              } catch (parseError) {
                console.error('❌ Error fazer parse das instituições:', parseError);
                localStorage.removeItem('allUserInstitutions');
                await loadUserInstitutions(userDate.id, userDate);
              }
            } else {
              // Se não tem todas, buscar no banco
              await loadUserInstitutions(userDate.id, userDate);
            }
            
            if (activeInstitution?.id) {
              await fetchStats(activeInstitution.id);
              
              // Verificar roles disponíveis na instituição atual
              const roles = await checkAvailableRoles(userDate.id, activeInstitution.id);
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
            console.log('⚠️ Institution ativa sem ID válido');
            await loadUserInstitutions(userDate.id, userDate);
          }
        } else {
          // Se não tem instituição ativa, buscar e definir
          console.log('ℹ️ Nenhuma instituição ativa, carregando do banco');
          await loadUserInstitutions(userDate.id, userDate);
        }
      } catch (error) {
        console.error('Erro na autenticação:', error);
        toast.error('Error verificar autenticação');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Close dropdown ao clicar fora
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

  // Close role dropdown ao clicar fora
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
        console.error('❌ Institution inválida para troca');
        toast.error('Institution inválida');
        return;
      }
      
      setInstitution(newInstitution);
      
      try {
        localStorage.setItem('activeInstitution', JSON.stringify(newInstitution));
      } catch (storageError) {
        console.error('❌ Error salvar instituição no localStorage:', storageError);
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
      console.error('Error trocar instituição:', error);
      toast.error('Error trocar instituição');
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
      
      toast.success(`Trocado para: ${newRole === 'admin' ? 'Administrador' : 'Teacher'}`);
    } catch (error) {
      console.error('Error trocar role:', error);
      toast.error('Error trocar papel');
    }
  };

    
    

  const handleLogout = () => {
    try {
      localStorage.removeItem('user');
      toast.success('Logout realizado com sucesso');
      router.push('/');
    } catch {
      toast.error('Error fazer logout');
    }
  };

  const cleanupOrphanedStudents = async () => {
    if (!institution?.id) return;
    
    try {
      // Search alunos órfãos (sem turma válida)
      const { data: orphanedStudents, error: orphanError } = await supabase
        .from('students')
        .select('id, name, class_id')
        .eq('institution_id', institution.id)
        .is('class_id', null);
      
      if (orphanError) {
        console.error('Error buscar alunos órfãos:', orphanError);
        return;
      }
      
      console.log('🧹 Students órfãos encontrados:', orphanedStudents?.length || 0);
      
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
            console.error('Error deletar alunos órfãos:', deleteError);
            toast.error('Error limpar alunos órfãos');
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
      toast.error('Error limpar dados');
    }
  };

  const handleCardClick = (feature: string) => {
    if (feature === 'Gerenciar Classs') {
      router.push('/admin/turmas');
      return;
    }
    
    if (feature === 'Gerenciar Students') {
      router.push('/admin/alunos');
      return;
    }
    
    if (feature === 'Types de Occurrences') {
      router.push('/admin/tipos-ocorrencias');
      return;
    }
    
    if (feature === 'Gerenciar Teacheres') {
      router.push('/admin/professores');
      return;
    }
    
    if (feature === 'Requests de Teacheres') {
      router.push('/admin/professores?tab=pending');
      return;
    }
    
    if (feature === 'Limpar Dados') {
      cleanupOrphanedStudents();
      return;
    }
    
    if (feature === 'Dashboard de Occurrences') {
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
          <p className="text-gray-600">Loading...</p>
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
      title: 'Gerenciar Classs',
      description: 'Create e organizar turmas',
      feature: 'Gerenciar Classs'
    },
    {
      icon: '🎓',
      title: 'Gerenciar Students',
      description: 'Register e editar alunos',
      feature: 'Gerenciar Students'
    },
    {
      icon: '📝',
      title: 'Types de Occurrences',
      description: 'Definir tipos de ocorrências',
      feature: 'Types de Occurrences'
    }
  ];

  const staffCards = [
    {
      icon: '👨‍🏫',
      title: 'Gerenciar Teacheres',
      description: 'Approve e gerenciar professores',
      feature: 'Gerenciar Teacheres'
    },
    {
      icon: '✅',
      title: 'Requests de Teacheres',
      description: 'Approve novas solicitações',
      feature: 'Requests de Teacheres',
      badge: stats.solicitacoesPendings
    }
  ];

  const analyticsCards = [
    {
      icon: '📊',
      title: 'Dashboard de Occurrences',
      description: 'View estatísticas',
      feature: 'Dashboard de Occurrences'
    },
    {
      icon: '📋',
      title: 'Reports',
      description: 'Gerar relatórios detalhados',
      feature: 'Reports'
    },
    {
      icon: '🧹',
      title: 'Limpar Dados',
      description: 'Remove alunos órfãos (sem turma)',
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
                  <p className="text-blue-50 font-semibold text-base">{institution?.nome || institution?.name || 'Loading...'}</p>
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
                      {activeRole === 'admin' ? 'Admin' : 'Teacher'}
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
                                {role === 'admin' ? 'Administrador' : 'Teacher'}
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
              <p className="text-blue-100">Welcome, {user.name}</p>
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
                <p className="text-sm font-medium text-gray-600">Total Classs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats.totalClasss}
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
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats.totalStudents}
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
                <p className="text-sm font-medium text-gray-600">Total Teacheres</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats.totalTeacheres}
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
                <p className="text-sm font-medium text-gray-600">Occurrences Este Mês</p>
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