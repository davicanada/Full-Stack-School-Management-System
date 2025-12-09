'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Usuario } from '@/types';
import toast from 'react-hot-toast';

interface Class {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  class_id: string;
}

interface OccurrenceType {
  id: string;
  name: string;
  description: string;
  severity: string;
}

export default function RegistrarOcorrenciaPage() {
  
  const [user, setUser] = useState<Usuario | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [occurrenceTypes, setOccurrenceTypes] = useState<OccurrenceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form states
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [occurrenceDate, setOccurrenceDate] = useState('');
  const [occurrenceTime, setOccurrenceTime] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().slice(0, 5);
      setOccurrenceDate(dateStr);
      setOccurrenceTime(timeStr);
    };

    init();
  }, []);

  useEffect(() => {
    if (user) {
      loadClasses();
      loadOccurrenceTypes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass);
      setSelectedStudents([]);
    } else {
      setStudents([]);
      setSelectedStudents([]);
    }
  }, [selectedClass]);

  const checkAuth = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      
      if (!storedUser) {
        window.location.href = '/';
        return;
      }

      const userData = JSON.parse(storedUser);
      
      if (!userData || userData.role !== 'professor') {
        toast.error('Acesso negado. Apenas professores podem registrar ocorrências.');
        window.location.href = '/';
        return;
      }

      setUser(userData);
    } catch (error) {
      console.error('Erro na autenticação:', error);
      toast.error('Erro ao verificar autenticação');
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };


  const loadClasses = async () => {
    if (!user?.institution_id) return;

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', user.institution_id)
        .order('name');
      
      if (error) {
        console.error('Erro ao carregar turmas:', error);
        toast.error('Erro ao carregar turmas');
        return;
      }
      
      if (data) {
        setClasses(data);
      }
    } catch (error) {
      console.error('Erro ao carregar turmas:', error);
      toast.error('Erro ao carregar turmas');
    }
  };

  const loadStudents = async (classId: string) => {
    try {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('name');

      if (data) {
        setStudents(data);
      }
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
      toast.error('Erro ao carregar alunos');
    }
  };

  const loadOccurrenceTypes = async () => {
    if (!user?.institution_id) return;

    try {
      const { data } = await supabase
        .from('occurrence_types')
        .select('*')
        .eq('institution_id', user.institution_id)
        .order('name');
      
      if (data) {
        setOccurrenceTypes(data);
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de ocorrência:', error);
      toast.error('Erro ao carregar tipos de ocorrência');
    }
  };

  const validateForm = () => {
    if (!selectedClass) {
      toast.error('Selecione uma turma');
      return false;
    }
    
    if (selectedStudents.length === 0) {
      toast.error('Selecione pelo menos um aluno');
      return false;
    }
    
    if (!selectedType) {
      toast.error('Selecione o tipo de ocorrência');
      return false;
    }
    
    if (!occurrenceDate) {
      toast.error('Selecione a data da ocorrência');
      return false;
    }
    
    if (!occurrenceTime) {
      toast.error('Selecione o horário da ocorrência');
      return false;
    }
    
    const occurrenceDateTime = new Date(`${occurrenceDate}T${occurrenceTime}`);
    const now = new Date();
    if (occurrenceDateTime > now) {
      toast.error('A data e hora da ocorrência não podem ser no futuro');
      return false;
    }
    
    if (description.trim().length > 0 && description.trim().length < 3) {
      toast.error('Se preenchida, a descrição deve ter pelo menos 3 caracteres');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      const occurrenceDateTime = new Date(`${occurrenceDate}T${occurrenceTime}`);
      
      // Criar múltiplas ocorrências, uma para cada aluno selecionado
      const occurrences = selectedStudents.map(studentId => ({
        student_id: studentId,
        class_id: selectedClass,
        occurrence_type_id: selectedType,
        teacher_id: user.id,
        institution_id: user.institution_id,
        description: description.trim() || null,
        occurred_at: occurrenceDateTime.toISOString()
      }));
      
      const { error } = await supabase
        .from('occurrences')
        .insert(occurrences)
        .select();
      
      if (error) {
        console.error('Erro ao registrar ocorrências:', error);
        toast.error('Erro ao registrar ocorrências. Tente novamente.');
      } else {
        const count = selectedStudents.length;
        toast.success(`${count} ocorrência${count > 1 ? 's' : ''} registrada${count > 1 ? 's' : ''} com sucesso!`);
        
        setTimeout(() => {
          window.location.href = '/professor';
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Erro crítico ao registrar ocorrências:', error);
      toast.error('Erro interno. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    window.location.href = '/professor';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-orange-600 dark:text-orange-400 font-medium">Carregando...</p>
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
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCancel}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Voltar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                📝 Registrar Nova Ocorrência
              </h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-orange-600 dark:text-orange-400">Professor</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-orange-200 dark:border-gray-700">
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Turma */}
            <div>
              <label htmlFor="class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Turma *
              </label>
              <select
                id="class"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Selecione uma turma</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Alunos - Seleção múltipla */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Alunos * (você pode selecionar vários)
              </label>
              {!selectedClass ? (
                <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                  Primeiro selecione uma turma
                </div>
              ) : students.length === 0 ? (
                <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                  Nenhum aluno encontrado nesta turma
                </div>
              ) : (
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                  {/* Botão para selecionar/desselecionar todos */}
                  <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 rounded-t-lg">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStudents.length === students.length && students.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents(students.map(s => s.id));
                          } else {
                            setSelectedStudents([]);
                          }
                        }}
                        className="rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-500 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Selecionar todos os alunos
                      </span>
                    </label>
                  </div>
                  
                  {/* Lista de alunos */}
                  <div className="p-3 max-h-40 overflow-y-auto">
                    <div className="space-y-2">
                      {students.map((student) => (
                        <label key={student.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudents(prev => [...prev, student.id]);
                              } else {
                                setSelectedStudents(prev => prev.filter(id => id !== student.id));
                              }
                            }}
                            className="rounded border-gray-300 text-orange-600 shadow-sm focus:border-orange-500 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{student.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {selectedStudents.length > 0 && (
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                  {selectedStudents.length} aluno{selectedStudents.length > 1 ? 's' : ''} selecionado{selectedStudents.length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Tipo de Ocorrência */}
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Ocorrência *
              </label>
              <select
                id="type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Selecione o tipo de ocorrência</option>
                {occurrenceTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.severity})
                  </option>
                ))}
              </select>
            </div>

            {/* Data e Hora */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data da Ocorrência *
                </label>
                <input
                  type="date"
                  id="date"
                  value={occurrenceDate}
                  onChange={(e) => setOccurrenceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Horário da Ocorrência *
                </label>
                <input
                  type="time"
                  id="time"
                  value={occurrenceTime}
                  onChange={(e) => setOccurrenceTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descrição (Opcional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                placeholder="Descreva o que aconteceu (opcional)"
              />
              {description.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {description.length} caracteres
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors inline-flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Registrar Ocorrência
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}