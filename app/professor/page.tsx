'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario, Institution } from '@/types';
import toast from 'react-hot-toast';

interface Stats {
  ocorrenciasHoje: number;
  ocorrenciasEsteMs: number;
  totalOcorrencias: number;
}

export default function ProfessorPage() {
  const router = useRouter();
  const [user, setUser] = useState<Usuario | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [stats, setStats] = useState<Stats>({
    ocorrenciasHoje: 0,
    ocorrenciasEsteMs: 0,
    totalOcorrencias: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async (userData: Usuario) => {
    try {
      // Calcular início e fim do dia atual e do mês atual
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Buscar contadores de ocorrências do professor
      const [ocorrenciasHojeResult, ocorrenciasMesResult, totalOcorrenciasResult] = await Promise.all([
        // Ocorrências hoje
        supabase
          .from('occurrences')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', userData.id)
          .gte('occurred_at', startOfToday)
          .lt('occurred_at', endOfToday),
        
        // Ocorrências este mês
        supabase
          .from('occurrences')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', userData.id)
          .gte('occurred_at', startOfMonth),
        
        // Total de ocorrências
        supabase
          .from('occurrences')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', userData.id)
      ]);

      setStats({
        ocorrenciasHoje: ocorrenciasHojeResult.count || 0,
        ocorrenciasEsteMs: ocorrenciasMesResult.count || 0,
        totalOcorrencias: totalOcorrenciasResult.count || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas do professor:', error);
      toast.error('Erro ao carregar estatísticas');
    }
  };

  useEffect(() => {

    const loadUserInstitution = async (userData: Usuario) => {
      try {
        let institutionId = userData.institution_id;
        
        // Se não tem institution_id direto, buscar em user_institutions
        if (!institutionId) {
          const { data: userInst, error } = await supabase
            .from('user_institutions')
            .select('institution_id')
            .eq('user_id', userData.id)
            .single();
          
          if (!error && userInst) {
            institutionId = userInst.institution_id;
          } else {
            toast.error('Professor não possui instituição associada');
            return;
          }
        }

        // Buscar dados completos da instituição
        const { data: institutionData, error } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', institutionId)
          .single();
        
        if (!error && institutionData) {
          setInstitution(institutionData);
          await fetchStats(userData);
        } else {
          toast.error('Erro ao carregar dados da instituição');
        }
      } catch (error) {
        console.error('Erro ao carregar instituição do professor:', error);
        toast.error('Erro ao carregar instituição');
      }
    };

    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        
        if (!storedUser) {
          router.push('/');
          return;
        }

        let userData;
        try {
          userData = JSON.parse(storedUser);
        } catch (parseError) {
          console.error('Erro ao fazer parse dos dados do usuário:', parseError);
          localStorage.removeItem('user');
          router.push('/');
          return;
        }
        
        // Verificar se tem role de professor
        if (!userData || userData.role !== 'professor') {
          toast.error('Acesso negado. Apenas professores podem acessar esta página.');
          router.push('/');
          return;
        }

        setUser(userData);
        
        // Buscar a instituição do professor
        await loadUserInstitution(userData);
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



  

  const handleLogout = () => {
    try {
      localStorage.removeItem('user');
      toast.success('Logout realizado com sucesso');
      router.push('/');
    } catch {
      toast.error('Erro ao fazer logout');
    }
  };

  const handleCardClick = (feature: string) => {
    if (feature === 'Registrar Ocorrência') {
      window.location.href = '/professor/registrar';
    } else if (feature === 'Minhas Ocorrências') {
      window.location.href = '/professor/ocorrencias';
    } else if (feature === 'Estatísticas') {
      toast('Funcionalidade em desenvolvimento: Estatísticas Detalhadas', { icon: '🚧', duration: 3000 });
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-orange-600 dark:text-orange-400 font-medium">Carregando área do professor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-orange-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                📚 Sistema Escolar - Professor
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Informações do Usuário */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">Professor</p>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Logout"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instituição Atual */}
        {institution && (
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-orange-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">{institution.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{institution.city} - {institution.state}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resumo Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-green-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ocorrências Hoje</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.ocorrenciasHoje}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Este Mês</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.ocorrenciasEsteMs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-purple-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalOcorrencias}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => handleCardClick('Registrar Ocorrência')}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-green-200 dark:border-gray-700 hover:shadow-md transition-all hover:border-green-300 dark:hover:border-green-600 text-left"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="ml-4 text-lg font-semibold text-gray-900 dark:text-white">Registrar Ocorrência</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Registre uma nova ocorrência disciplinar ou comportamental
            </p>
            <div className="flex items-center text-green-600 dark:text-green-400">
              <span className="text-sm font-medium">Novo registro</span>
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          <button
            onClick={() => handleCardClick('Minhas Ocorrências')}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-200 dark:border-gray-700 hover:shadow-md transition-all hover:border-blue-300 dark:hover:border-blue-600 text-left"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="ml-4 text-lg font-semibold text-gray-900 dark:text-white">Minhas Ocorrências</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Visualize e gerencie todas as ocorrências registradas por você
            </p>
            <div className="flex items-center text-blue-600 dark:text-blue-400">
              <span className="text-sm font-medium">Ver registros</span>
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          <button
            onClick={() => handleCardClick('Estatísticas')}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-purple-200 dark:border-gray-700 hover:shadow-md transition-all hover:border-purple-300 dark:hover:border-purple-600 text-left"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="ml-4 text-lg font-semibold text-gray-900 dark:text-white">Estatísticas</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Visualize relatórios e análises detalhadas das ocorrências
            </p>
            <div className="flex items-center text-purple-600 dark:text-purple-400">
              <span className="text-sm font-medium">Ver relatórios</span>
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Estado Vazio */}
        {stats.totalOcorrencias === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nenhuma ocorrência registrada
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Você ainda não registrou nenhuma ocorrência. Use o botão "Registrar Ocorrência" acima para começar.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}