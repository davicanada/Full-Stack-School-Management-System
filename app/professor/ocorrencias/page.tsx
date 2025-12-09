'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario } from '@/types';
import toast, { Toaster } from 'react-hot-toast';

interface Occurrence {
  id: string;
  occurred_at: string;
  description: string;
  student_id: string;
  class_id: string;
  occurrence_type_id: string;
  students: { name: string };
  classes: { name: string };
  occurrence_types: { name: string; severity: string };
}

interface Class {
  id: string;
  name: string;
}

interface OccurrenceType {
  id: string;
  name: string;
  severity: string;
}

export default function MinhasOcorrenciasPage() {
  const router = useRouter();
  const [user, setUser] = useState<Usuario | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [occurrenceTypes, setOccurrenceTypes] = useState<OccurrenceType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  
  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        
        if (!storedUser) {
          router.push('/');
          return;
        }

        const userData = JSON.parse(storedUser);
        
        if (!userData || userData.role !== 'professor') {
          toast.error('Acesso negado. Apenas professores podem acessar esta página.');
          router.push('/');
          return;
        }

        setUser(userData);
        await loadOccurrences(userData);
        await loadFiltersData(userData);
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

  const loadOccurrences = async (userData: Usuario) => {
    try {
      const { data, error } = await supabase
        .from('occurrences')
        .select(`
          *,
          students(name),
          classes(name),
          occurrence_types(name, severity)
        `)
        .eq('teacher_id', userData.id)
        .order('occurred_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar ocorrências:', error);
        toast.error('Erro ao carregar ocorrências');
        return;
      }

      setOccurrences(data || []);
    } catch (error) {
      console.error('Erro ao carregar ocorrências:', error);
      toast.error('Erro ao carregar ocorrências');
    }
  };

  const loadFiltersData = async (userData: Usuario) => {
    try {
      // Buscar turmas onde o professor tem ocorrências
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('institution_id', userData.institution_id)
        .order('name');

      if (!classesError && classesData) {
        setClasses(classesData);
      }

      // Buscar tipos de ocorrência
      const { data: typesData, error: typesError } = await supabase
        .from('occurrence_types')
        .select('*')
        .eq('institution_id', userData.institution_id)
        .order('name');

      if (!typesError && typesData) {
        setOccurrenceTypes(typesData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados dos filtros:', error);
    }
  };

  const handleDeleteOccurrence = async (occurrenceId: string, studentName: string) => {
    const confirmed = window.confirm(`Tem certeza que deseja excluir a ocorrência do aluno ${studentName}?`);
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('occurrences')
        .delete()
        .eq('id', occurrenceId)
        .eq('teacher_id', user?.id); // Segurança: só pode deletar suas próprias ocorrências

      if (error) {
        console.error('Erro ao excluir ocorrência:', error);
        toast.error('Erro ao excluir ocorrência');
        return;
      }

      toast.success('Ocorrência excluída com sucesso!');
      if (user) await loadOccurrences(user);
    } catch (error) {
      console.error('Erro ao excluir ocorrência:', error);
      toast.error('Erro ao excluir ocorrência');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'leve':
        return 'bg-yellow-100 text-yellow-800';
      case 'moderada':
        return 'bg-orange-100 text-orange-800';
      case 'grave':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filtrar ocorrências
  const filteredOccurrences = occurrences.filter(occurrence => {
    const matchesSearch = occurrence.students?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         occurrence.classes?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         occurrence.occurrence_types?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = classFilter === '' || occurrence.class_id === classFilter;
    const matchesType = typeFilter === '' || occurrence.occurrence_type_id === typeFilter;
    const matchesSeverity = severityFilter === '' || occurrence.occurrence_types?.severity === severityFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const occurrenceDate = new Date(occurrence.occurred_at).toISOString().split('T')[0];
      matchesDate = occurrenceDate === dateFilter;
    }
    
    return matchesSearch && matchesClass && matchesType && matchesSeverity && matchesDate;
  });

  // Paginação
  const totalPages = Math.ceil(filteredOccurrences.length / itemsPerPage);
  const paginatedOccurrences = filteredOccurrences.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const clearFilters = () => {
    setSearchTerm('');
    setClassFilter('');
    setTypeFilter('');
    setDateFilter('');
    setSeverityFilter('');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-orange-600 font-medium">Carregando ocorrências...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-orange-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/professor')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Voltar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-orange-600">
                📋 Minhas Ocorrências
              </h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-orange-600">Professor</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Busca */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <input
                type="text"
                placeholder="Nome do aluno, turma ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            
            {/* Filtro por turma */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Turma
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todas</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            
            {/* Filtro por tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todos</option>
                {occurrenceTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            
            {/* Filtro por gravidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gravidade
              </label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todas</option>
                <option value="leve">Leve</option>
                <option value="moderada">Moderada</option>
                <option value="grave">Grave</option>
              </select>
            </div>
            
            {/* Filtro por data */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Mostrando {paginatedOccurrences.length} de {filteredOccurrences.length} ocorrências
            </p>
            <button
              onClick={clearFilters}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Lista de Ocorrências */}
        {filteredOccurrences.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma ocorrência encontrada
            </h3>
            <p className="text-gray-500">
              Você ainda não registrou nenhuma ocorrência ou os filtros não retornaram resultados.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aluno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Turma
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedOccurrences.map((occurrence) => (
                    <tr key={occurrence.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(occurrence.occurred_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {occurrence.students?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {occurrence.classes?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {occurrence.occurrence_types?.name || 'N/A'}
                          </span>
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(occurrence.occurrence_types?.severity || '')}`}>
                            {occurrence.occurrence_types?.severity || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="max-w-xs truncate" title={occurrence.description}>
                          {occurrence.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteOccurrence(occurrence.id, occurrence.students?.name || '')}
                          className="text-red-600 hover:text-red-900 transition-colors"
                          title="Excluir ocorrência"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Paginação */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Mostrando <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> até{' '}
                      <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredOccurrences.length)}</span> de{' '}
                      <span className="font-medium">{filteredOccurrences.length}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage
                              ? 'z-10 bg-orange-50 border-orange-500 text-orange-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
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