'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario, Institution } from '@/types';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Class {
  id: string;
  name: string;
  institution_id: string;
  academic_year: number;
  education_level?: string;
  grade?: string;
  shift?: string;
  is_active: boolean;
  created_at: string;
  deleted_at?: string;
  deleted_by?: string;
  student_count?: number;
}

// Dados do Sistema Educacional Brasileiro - ATUALIZADO
const EDUCATION_LEVELS = {
  creche: {
    label: 'Creche (0-3 anos)',
    icon: '👶',
    grades: ['Berçário I', 'Berçário II', 'Maternal I', 'Maternal II']
  },
  pre_escola: {
    label: 'Pré-escola (4-5 anos)',
    icon: '🎨',
    grades: ['Pré I', 'Pré II']
  },
  fundamental: {
    label: 'Ensino Fundamental (1º ao 9º ano)',
    icon: '📚',
    grades: ['1º ano', '2º ano', '3º ano', '4º ano', '5º ano', '6º ano', '7º ano', '8º ano', '9º ano']
  },
  ensino_medio: {
    label: 'Ensino Médio',
    icon: '🎓',
    grades: ['1ª série', '2ª série', '3ª série', '4ª série']
  },
  custom: {
    label: 'Outro (customizado)',
    icon: '✏️',
    grades: []
  }
};

const SHIFTS = [
  { value: 'matutino', label: 'Matutino', icon: '🌅' },
  { value: 'vespertino', label: 'Vespertino', icon: '☀️' },
  { value: 'noturno', label: 'Noturno', icon: '🌙' },
  { value: 'integral', label: 'Integral', icon: '🌞' }
];

interface WizardFormData {
  education_level: string;
  grade: string;
  custom_grade: string;
  class_code: string;
  academic_year: number;
  shift: string;
  is_active: boolean;
}

export default function TurmasPage() {
  const router = useRouter();
  const [user, setUser] = useState<Usuario | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [trashedClasses, setTrashedClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);

  // Wizard States
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [duplicatingClass, setDuplicatingClass] = useState<Class | null>(null);

  // Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  // Filtro por ano
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Importação do ano anterior
  const [previousYearClasses, setPreviousYearClasses] = useState<Class[]>([]);
  const [selectedClassesToImport, setSelectedClassesToImport] = useState<string[]>([]);
  const [importingClasses, setImportingClasses] = useState(false);

  const [wizardFormData, setWizardFormData] = useState<WizardFormData>({
    education_level: '',
    grade: '',
    custom_grade: '',
    class_code: '',
    academic_year: currentYear,
    shift: '',
    is_active: true,
  });

  const fetchClasses = async (institutionId: string, year?: number) => {
    try {
      let query = supabase
        .from('classes')
        .select('*')
        .eq('institution_id', institutionId)
        .is('deleted_at', null);

      if (year) {
        query = query.eq('academic_year', year);
      }

      const { data: classesData, error } = await query.order('academic_year', { ascending: false }).order('name');

      if (error) {
        console.error('Erro ao buscar turmas:', error);
        toast.error('Erro ao carregar turmas');
        return;
      }

      // Buscar quantidade de alunos para cada turma
      const classesWithStudentCount = await Promise.all(
        (classesData || []).map(async (classItem) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', classItem.id)
            .is('deleted_at', null);

          return {
            ...classItem,
            student_count: count || 0,
          };
        })
      );

      setClasses(classesWithStudentCount);

      // Extrair anos únicos disponíveis
      const years = Array.from(new Set(classesWithStudentCount.map(c => c.academic_year))).sort((a, b) => b - a);
      setAvailableYears(years);
    } catch (error) {
      console.error('Erro ao buscar turmas:', error);
      toast.error('Erro ao carregar turmas');
    }
  };

  const fetchTrashedClasses = async (institutionId: string) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', institutionId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;

      // Buscar quantidade de alunos
      const classesWithCount = await Promise.all(
        (data || []).map(async (classItem) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', classItem.id)
            .is('deleted_at', null);

          return {
            ...classItem,
            student_count: count || 0,
          };
        })
      );

      setTrashedClasses(classesWithCount);
    } catch (error) {
      console.error('Erro ao buscar lixeira:', error);
      toast.error('Erro ao carregar lixeira');
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');

        if (!storedUser) {
          router.push('/');
          return;
        }

        const userData = JSON.parse(storedUser);

        if (!userData || userData.role !== 'admin') {
          toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
          router.push('/');
          return;
        }

        setUser(userData);

        const { data: institutionData, error: institutionError } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', userData.institution_id)
          .single();

        if (institutionError) {
          toast.error('Erro ao carregar dados da instituição');
        } else {
          setInstitution(institutionData);
        }

        await fetchClasses(userData.institution_id);
        await fetchTrashedClasses(userData.institution_id);
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

  // Atualizar quando mudar o filtro de ano
  useEffect(() => {
    if (user?.institution_id) {
      fetchClasses(user.institution_id, selectedYear);
    }
  }, [selectedYear, user]);

  // Wizard Navigation
  const nextStep = () => {
    if (wizardStep < 5) setWizardStep(wizardStep + 1);
  };

  const prevStep = () => {
    if (wizardStep > 1) setWizardStep(wizardStep - 1);
  };

  const canProceedToNextStep = (): boolean => {
    switch (wizardStep) {
      case 1:
        return wizardFormData.education_level !== '';
      case 2:
        if (wizardFormData.education_level === 'custom') {
          return wizardFormData.custom_grade.trim() !== '';
        }
        return wizardFormData.grade !== '';
      case 3:
        return wizardFormData.class_code.trim() !== '';
      case 4:
        return wizardFormData.shift !== '';
      default:
        return true;
    }
  };

  const resetWizard = () => {
    setWizardFormData({
      education_level: '',
      grade: '',
      custom_grade: '',
      class_code: '',
      academic_year: selectedYear,
      shift: '',
      is_active: true,
    });
    setWizardStep(1);
    setEditingClass(null);
    setDuplicatingClass(null);
  };

  const openWizard = () => {
    resetWizard();
    setShowWizard(true);
  };

  const closeWizard = () => {
    setShowWizard(false);
    resetWizard();
  };

  // Verificar se turma já existe
  const checkDuplicate = async (className: string, academicYear: number, excludeId?: string): Promise<boolean> => {
    if (!user?.institution_id) return false;

    try {
      let query = supabase
        .from('classes')
        .select('id')
        .eq('institution_id', user.institution_id)
        .eq('name', className.trim())
        .eq('academic_year', academicYear)
        .is('deleted_at', null);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data && data.length > 0);
    } catch (error) {
      console.error('Erro ao verificar duplicata:', error);
      return false;
    }
  };

  const handleWizardSubmit = async (saveAndExit = false) => {
    if (!user || !user.institution_id) return;

    try {
      // Construir nome da turma
      let fullClassName = '';

      if (wizardFormData.education_level === 'custom') {
        fullClassName = `${wizardFormData.custom_grade} ${wizardFormData.class_code}`;
      } else {
        const grade = wizardFormData.grade;
        fullClassName = `${grade} ${wizardFormData.class_code}`;
      }

      // Verificar duplicata
      const isDuplicate = await checkDuplicate(
        fullClassName,
        wizardFormData.academic_year,
        editingClass?.id
      );

      if (isDuplicate) {
        toast.error(`Já existe uma turma "${fullClassName}" para o ano ${wizardFormData.academic_year}`);
        return;
      }

      const classData = {
        name: fullClassName.trim(),
        education_level: wizardFormData.education_level,
        grade: wizardFormData.education_level === 'custom' ? wizardFormData.custom_grade : wizardFormData.grade,
        shift: wizardFormData.shift,
        academic_year: wizardFormData.academic_year,
        is_active: wizardFormData.is_active,
        institution_id: user.institution_id,
      };

      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update(classData)
          .eq('id', editingClass.id);

        if (error) throw error;
        toast.success('Turma atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert(classData);

        if (error) throw error;

        toast.success(`Turma ${fullClassName} criada com sucesso!`);
      }

      if (saveAndExit || wizardStep === 5) {
        closeWizard();
      }

      await fetchClasses(user.institution_id, selectedYear);
    } catch (error) {
      console.error('Erro ao salvar turma:', error);
      toast.error('Erro ao salvar turma');
    }
  };

  const handleEdit = (classItem: Class) => {
    setEditingClass(classItem);
    setDuplicatingClass(null);

    // Preencher wizard com dados da turma
    setWizardFormData({
      education_level: classItem.education_level || 'custom',
      grade: classItem.grade || '',
      custom_grade: classItem.education_level === 'custom' ? classItem.grade || '' : '',
      class_code: classItem.name.split(' ').pop() || '',
      academic_year: classItem.academic_year,
      shift: classItem.shift || '',
      is_active: classItem.is_active,
    });

    setWizardStep(1);
    setShowWizard(true);
  };

  const handleDuplicate = (classItem: Class) => {
    setDuplicatingClass(classItem);
    setEditingClass(null);

    // Preencher wizard com dados da turma (mas sem o ID, para criar uma nova)
    setWizardFormData({
      education_level: classItem.education_level || 'custom',
      grade: classItem.grade || '',
      custom_grade: classItem.education_level === 'custom' ? classItem.grade || '' : '',
      class_code: '', // Deixar vazio para usuário preencher
      academic_year: selectedYear, // Usar ano atual selecionado
      shift: classItem.shift || '',
      is_active: true,
    });

    setWizardStep(3); // Ir direto para etapa de código da turma
    setShowWizard(true);
  };

  const handleMoveToTrash = async (classItem: Class) => {
    if (!user) return;

    const confirmDelete = window.confirm(
      `Tem certeza que deseja mover a turma "${classItem.name}" para a lixeira?\n\nA turma será desativada automaticamente.`
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('classes')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          is_active: false
        })
        .eq('id', classItem.id);

      if (error) throw error;

      toast.success('Turma movida para lixeira e desativada!');
      await fetchClasses(user.institution_id!, selectedYear);
      await fetchTrashedClasses(user.institution_id!);
    } catch (error) {
      console.error('Erro ao mover turma para lixeira:', error);
      toast.error('Erro ao mover turma para lixeira');
    }
  };

  const handleRestoreFromTrash = async (classItem: Class) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('classes')
        .update({
          deleted_at: null,
          deleted_by: null,
          is_active: true
        })
        .eq('id', classItem.id);

      if (error) throw error;

      toast.success('Turma restaurada e reativada com sucesso!');
      await fetchClasses(user.institution_id!, selectedYear);
      await fetchTrashedClasses(user.institution_id!);
    } catch (error) {
      console.error('Erro ao restaurar turma:', error);
      toast.error('Erro ao restaurar turma');
    }
  };

  const handlePermanentDelete = async (classItem: Class) => {
    if (!user) return;

    const confirmDelete = window.confirm(
      `ATENÇÃO: Tem certeza que deseja EXCLUIR PERMANENTEMENTE a turma "${classItem.name}"?\n\n` +
      `Esta ação NÃO PODE SER DESFEITA e todos os dados relacionados serão perdidos.`
    );

    if (!confirmDelete) return;

    try {
      // Verificar se há alunos
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classItem.id)
        .is('deleted_at', null);

      if (studentsError) throw studentsError;

      if (students && students.length > 0) {
        toast.error(`Não é possível excluir. Existem ${students.length} aluno(s) nesta turma.`);
        return;
      }

      // Verificar se há ocorrências
      const { data: occurrences, error: occurrencesError } = await supabase
        .from('occurrences')
        .select('id')
        .eq('class_id', classItem.id);

      if (occurrencesError) throw occurrencesError;

      if (occurrences && occurrences.length > 0) {
        toast.error(`Não é possível excluir. Existem ${occurrences.length} ocorrência(s) registrada(s) nesta turma.`);
        return;
      }

      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classItem.id);

      if (error) throw error;

      toast.success('Turma excluída permanentemente!');
      await fetchTrashedClasses(user.institution_id!);
    } catch (error) {
      console.error('Erro ao excluir turma permanentemente:', error);
      toast.error('Erro ao excluir turma');
    }
  };


  // Importação do Ano Anterior
  const handleOpenImportModal = async () => {
    if (!user?.institution_id) return;

    const previousYear = selectedYear - 1;

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', user.institution_id)
        .eq('academic_year', previousYear)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error(`Não existem turmas cadastradas para o ano ${previousYear}`);
        return;
      }

      const classesWithCount = await Promise.all(
        data.map(async (cls) => {
          const { count } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .is('deleted_at', null);

          return { ...cls, student_count: count || 0 };
        })
      );

      setPreviousYearClasses(classesWithCount);
      setSelectedClassesToImport([]);
      setShowImportModal(true);
    } catch (error) {
      console.error('Erro ao buscar turmas do ano anterior:', error);
      toast.error('Erro ao buscar turmas para importação');
    }
  };

  const handleToggleClassSelection = (classId: string) => {
    setSelectedClassesToImport(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleImportClasses = async () => {
    if (!user?.institution_id || selectedClassesToImport.length === 0) return;

    setImportingClasses(true);

    try {
      const classesToImport = previousYearClasses.filter(c =>
        selectedClassesToImport.includes(c.id)
      );

      const newClasses = classesToImport.map(cls => ({
        name: cls.name,
        education_level: cls.education_level,
        grade: cls.grade,
        shift: cls.shift,
        institution_id: user.institution_id!,
        academic_year: selectedYear,
        is_active: true
      }));

      const { error } = await supabase
        .from('classes')
        .insert(newClasses);

      if (error) {
        if (error.code === '23505') {
          toast.error('Algumas turmas já existem para este ano. Importação parcial pode ter ocorrido.');
        } else {
          throw error;
        }
      } else {
        toast.success(`${newClasses.length} turma(s) importada(s) com sucesso!`);
      }

      setShowImportModal(false);
      setSelectedClassesToImport([]);
      await fetchClasses(user.institution_id, selectedYear);
    } catch (error) {
      console.error('Erro ao importar turmas:', error);
      toast.error('Erro ao importar turmas');
    } finally {
      setImportingClasses(false);
    }
  };

  // Importação em Lote via Excel
  const handleBulkImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.institution_id) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast.error('Planilha vazia');
          return;
        }

        // Validar estrutura
        const requiredFields = ['nivel_ensino', 'serie_ano', 'turma', 'turno', 'ano_letivo'];
        const firstRow = jsonData[0];
        const hasAllFields = requiredFields.every(field => field in firstRow);

        if (!hasAllFields) {
          toast.error(`Planilha inválida. Campos obrigatórios: ${requiredFields.join(', ')}`);
          return;
        }

        // Processar dados
        const classesToInsert = jsonData.map(row => {
          const fullName = `${row.serie_ano} ${row.turma}`.trim();

          return {
            name: fullName,
            education_level: row.nivel_ensino,
            grade: row.serie_ano,
            shift: row.turno,
            academic_year: parseInt(row.ano_letivo),
            institution_id: user.institution_id!,
            is_active: true
          };
        });

        // Inserir no banco
        const { error } = await supabase
          .from('classes')
          .insert(classesToInsert);

        if (error) {
          if (error.code === '23505') {
            toast.error('Algumas turmas já existem. Importação parcial pode ter ocorrido.');
          } else {
            throw error;
          }
        } else {
          toast.success(`${classesToInsert.length} turma(s) importada(s) com sucesso!`);
        }

        setShowBulkImportModal(false);
        await fetchClasses(user.institution_id, selectedYear);
      } catch (error) {
        console.error('Erro ao processar planilha:', error);
        toast.error('Erro ao processar planilha Excel');
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const downloadExampleTemplate = () => {
    const template = [
      {
        nivel_ensino: 'fundamental',
        serie_ano: '1º ano',
        turma: 'A',
        turno: 'matutino',
        ano_letivo: currentYear
      },
      {
        nivel_ensino: 'fundamental',
        serie_ano: '6º ano',
        turma: 'B',
        turno: 'vespertino',
        ano_letivo: currentYear
      },
      {
        nivel_ensino: 'ensino_medio',
        serie_ano: '1ª série',
        turma: 'A',
        turno: 'matutino',
        ano_letivo: currentYear
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Turmas');
    XLSX.writeFile(wb, 'modelo_importacao_turmas.xlsx');
    toast.success('Modelo baixado com sucesso!');
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

  const getShiftLabel = (shift: string) => {
    const shiftData = SHIFTS.find(s => s.value === shift);
    return shiftData ? `${shiftData.icon} ${shiftData.label}` : shift;
  };

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
                Voltar
              </button>
              <div>
                <h1 className="text-2xl font-bold">Gerenciar Turmas</h1>
                <p className="text-blue-100">{institution.nome}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTrash(!showTrash)}
                className={`px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                  showTrash
                    ? 'bg-gray-700 hover:bg-gray-800'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {showTrash ? 'Ver Turmas Ativas' : `Lixeira (${trashedClasses.length})`}
              </button>
              {!showTrash && (
                <>
                  <button
                    onClick={() => setShowBulkImportModal(true)}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Importar Excel
                  </button>
                  <button
                    onClick={handleOpenImportModal}
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Importar Ano Anterior
                  </button>
                  <button
                    onClick={openWizard}
                    className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nova Turma
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showTrash ? (
          // LIXEIRA
          <div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-red-800">
                  <strong>Lixeira:</strong> Turmas aqui podem ser restauradas ou excluídas permanentemente
                </span>
              </div>
            </div>

            {trashedClasses.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Lixeira vazia</h3>
                <p className="text-gray-500">Nenhuma turma na lixeira</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trashedClasses.map((classItem) => (
                  <div key={classItem.id} className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{classItem.name}</h3>
                        <p className="text-sm text-gray-500">Ano letivo: {classItem.academic_year}</p>

                        {/* Nível de Ensino */}
                        {classItem.education_level && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-lg">{EDUCATION_LEVELS[classItem.education_level as keyof typeof EDUCATION_LEVELS]?.icon || '📚'}</span>
                            <span className="text-sm font-medium text-gray-700">
                              {EDUCATION_LEVELS[classItem.education_level as keyof typeof EDUCATION_LEVELS]?.label.split(' (')[0] || classItem.education_level}
                            </span>
                          </div>
                        )}

                        {/* Turno */}
                        {classItem.shift && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg">{SHIFTS.find(s => s.value === classItem.shift)?.icon || '⏰'}</span>
                            <span className="text-sm text-gray-600">{getShiftLabel(classItem.shift)}</span>
                          </div>
                        )}

                        <p className="text-sm text-red-600 mt-2">
                          Excluída em: {new Date(classItem.deleted_at!).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestoreFromTrash(classItem)}
                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Restaurar
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(classItem)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // TURMAS ATIVAS
          <>
            {/* Filtro de Ano */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Filtrar por Ano Letivo:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  {availableYears.length > 0 && (
                    <span className="text-sm text-gray-500">
                      Anos disponíveis: {availableYears.join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {classes.length} turma(s) em {selectedYear}
                </div>
              </div>
            </div>

            {classes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma turma para {selectedYear}</h3>
                <p className="text-gray-500 mb-6">Crie uma nova turma, importe do ano anterior ou use planilha Excel</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={openWizard}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
                  >
                    Criar Nova Turma
                  </button>
                  <button
                    onClick={handleOpenImportModal}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
                  >
                    Importar de {selectedYear - 1}
                  </button>
                  <button
                    onClick={() => setShowBulkImportModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
                  >
                    Importar Excel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes.map((classItem) => (
                  <div key={classItem.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{classItem.name}</h3>
                      <p className="text-sm text-gray-500">Ano letivo: {classItem.academic_year}</p>

                      {/* Nível de Ensino */}
                      {classItem.education_level && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-lg">{EDUCATION_LEVELS[classItem.education_level as keyof typeof EDUCATION_LEVELS]?.icon || '📚'}</span>
                          <span className="text-sm font-medium text-gray-700">
                            {EDUCATION_LEVELS[classItem.education_level as keyof typeof EDUCATION_LEVELS]?.label.split(' (')[0] || classItem.education_level}
                          </span>
                        </div>
                      )}

                      {/* Turno */}
                      {classItem.shift && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-lg">{SHIFTS.find(s => s.value === classItem.shift)?.icon || '⏰'}</span>
                          <span className="text-sm text-gray-600">{getShiftLabel(classItem.shift)}</span>
                        </div>
                      )}

                      <p className="text-sm text-gray-500 mt-2 font-medium">{classItem.student_count} aluno(s)</p>
                    </div>
                    <div className="mb-3">
                      <button
                        onClick={() => router.push(`/admin/alunos?turma=${classItem.id}`)}
                        className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Ver Alunos ({classItem.student_count})
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        onClick={() => handleEdit(classItem)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDuplicate(classItem)}
                        className="bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Duplicar
                      </button>
                    </div>
                    <button
                      onClick={() => handleMoveToTrash(classItem)}
                      className="w-full bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                      title="Mover para lixeira"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Mover para Lixeira
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Wizard Modal */}
      {showWizard && (
        <WizardModal
          step={wizardStep}
          formData={wizardFormData}
          setFormData={setWizardFormData}
          onNext={nextStep}
          onPrev={prevStep}
          onClose={closeWizard}
          onSubmit={handleWizardSubmit}
          onSaveAndExit={() => handleWizardSubmit(true)}
          canProceed={canProceedToNextStep()}
          isEditing={!!editingClass}
          isDuplicating={!!duplicatingClass}
        />
      )}

      {/* Modal Importar do Ano Anterior */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Importar Turmas de {selectedYear - 1} para {selectedYear}
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Selecione as turmas que deseja copiar. Apenas a estrutura será copiada (sem alunos).
            </p>
            <div className="space-y-2 mb-6">
              {previousYearClasses.map((cls) => (
                <label
                  key={cls.id}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedClassesToImport.includes(cls.id)}
                    onChange={() => handleToggleClassSelection(cls.id)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-gray-900">{cls.name}</span>
                        {cls.shift && (
                          <span className="ml-2 text-sm text-gray-600">{getShiftLabel(cls.shift)}</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{cls.student_count} aluno(s) em {selectedYear - 1}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportClasses}
                disabled={selectedClassesToImport.length === 0 || importingClasses}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors duration-200"
              >
                {importingClasses ? 'Importando...' : `Importar ${selectedClassesToImport.length} turma(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importação em Lote Excel */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Importação em Lote via Excel
              </h3>
              <button
                onClick={() => setShowBulkImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">📋 Estrutura da Planilha</h4>
              <p className="text-sm text-blue-800 mb-3">A planilha deve conter as seguintes colunas:</p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>nivel_ensino</strong>: creche, pre_escola, fundamental, ensino_medio, custom</li>
                <li><strong>serie_ano</strong>: 1º ano, 6º ano, 1ª série, etc.</li>
                <li><strong>turma</strong>: A, B, C, etc.</li>
                <li><strong>turno</strong>: matutino, vespertino, noturno, integral</li>
                <li><strong>ano_letivo</strong>: 2025, 2026, etc.</li>
              </ul>
            </div>

            <div className="flex gap-3 mb-6">
              <button
                onClick={downloadExampleTemplate}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Baixar Modelo de Exemplo
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleBulkImportExcel}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 mb-1">
                    Clique para selecionar arquivo Excel
                  </span>
                  <span className="text-xs text-gray-500">
                    Formatos aceitos: .xlsx, .xls
                  </span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}

// Wizard Component - ATUALIZADO
interface WizardModalProps {
  step: number;
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onSubmit: (saveAndExit?: boolean) => void;
  onSaveAndExit: () => void;
  canProceed: boolean;
  isEditing: boolean;
  isDuplicating: boolean;
}

function WizardModal({
  step,
  formData,
  setFormData,
  onNext,
  onPrev,
  onClose,
  onSubmit,
  onSaveAndExit,
  canProceed,
  isEditing,
  isDuplicating
}: WizardModalProps) {
  const steps = [
    { number: 1, label: 'Nível de Ensino' },
    { number: 2, label: 'Série/Ano' },
    { number: 3, label: 'Turma' },
    { number: 4, label: 'Turno' },
    { number: 5, label: 'Confirmar' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header - FIXO */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-lg flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold">
              {isDuplicating ? 'Duplicar Turma' : isEditing ? 'Editar Turma' : 'Criar Nova Turma'}
            </h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                      step >= s.number
                        ? 'bg-white text-orange-600'
                        : 'bg-orange-500 text-white'
                    }`}
                  >
                    {step > s.number ? '✓' : s.number}
                  </div>
                  <span className="text-xs mt-2 text-center font-medium">{s.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 ${step > s.number ? 'bg-white' : 'bg-orange-500'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content - SCROLLÁVEL */}
        <div className="p-8 overflow-y-auto flex-grow">
          {/* Step 1: Nível de Ensino */}
          {step === 1 && (
            <div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Selecione o Nível de Ensino</h4>
              <p className="text-gray-600 mb-6">Escolha o nível de ensino da turma</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(EDUCATION_LEVELS).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setFormData({ ...formData, education_level: key, grade: '', custom_grade: '' })}
                    className={`p-4 border-2 rounded-lg transition-all text-left ${
                      formData.education_level === key
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">{value.icon}</div>
                    <div className="font-semibold text-gray-900">{value.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Série/Ano */}
          {step === 2 && (
            <div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Selecione a Série/Ano</h4>
              <p className="text-gray-600 mb-6">
                {formData.education_level && EDUCATION_LEVELS[formData.education_level as keyof typeof EDUCATION_LEVELS]?.label}
              </p>

              {formData.education_level === 'custom' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Digite o nome da série/ano
                  </label>
                  <input
                    type="text"
                    value={formData.custom_grade}
                    onChange={(e) => setFormData({ ...formData, custom_grade: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: Maternal III, Pré II, etc."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {formData.education_level &&
                    EDUCATION_LEVELS[formData.education_level as keyof typeof EDUCATION_LEVELS]?.grades.map((grade) => (
                      <button
                        key={grade}
                        onClick={() => setFormData({ ...formData, grade })}
                        className={`p-4 border-2 rounded-lg font-semibold transition-all ${
                          formData.grade === grade
                            ? 'border-orange-600 bg-orange-50 text-orange-900'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        {grade}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Nome/Código da Turma */}
          {step === 3 && (
            <div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Definição da Turma</h4>
              <p className="text-gray-600 mb-6">Informe o código ou nome da turma e o ano letivo</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código da Turma *
                  </label>
                  <input
                    type="text"
                    value={formData.class_code}
                    onChange={(e) => setFormData({ ...formData, class_code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Ex: A, B, C, 101, etc."
                    maxLength={10}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Nome completo: {formData.education_level === 'custom' ? formData.custom_grade : formData.grade} {formData.class_code}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ano Letivo *
                  </label>
                  <input
                    type="number"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    min="2020"
                    max="2030"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active_wizard"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active_wizard" className="ml-2 text-sm text-gray-700">
                    Turma ativa
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Turno */}
          {step === 4 && (
            <div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Selecione o Turno</h4>
              <p className="text-gray-600 mb-6">Escolha o período em que a turma funcionará</p>

              <div className="grid grid-cols-2 gap-4">
                {SHIFTS.map((shift) => (
                  <button
                    key={shift.value}
                    onClick={() => setFormData({ ...formData, shift: shift.value })}
                    className={`p-6 border-2 rounded-lg transition-all ${
                      formData.shift === shift.value
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="text-4xl mb-2">{shift.icon}</div>
                    <div className="font-semibold text-gray-900">{shift.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Confirmação */}
          {step === 5 && (
            <div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Confirmação</h4>
              <p className="text-gray-600 mb-6">Revise as informações antes de finalizar</p>

              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Nível de Ensino</p>
                  <p className="font-semibold text-gray-900">
                    {EDUCATION_LEVELS[formData.education_level as keyof typeof EDUCATION_LEVELS]?.label}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Série/Ano</p>
                  <p className="font-semibold text-gray-900">
                    {formData.education_level === 'custom' ? formData.custom_grade : formData.grade}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Nome Completo da Turma</p>
                  <p className="font-semibold text-gray-900 text-lg">
                    {formData.education_level === 'custom' ? formData.custom_grade : formData.grade} {formData.class_code}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Turno</p>
                  <p className="font-semibold text-gray-900">
                    {SHIFTS.find(s => s.value === formData.shift)?.label}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Ano Letivo</p>
                  <p className="font-semibold text-gray-900">{formData.academic_year}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-semibold text-gray-900">
                    {formData.is_active ? 'Ativa' : 'Inativa'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - FIXO */}
        <div className="bg-gray-50 px-8 py-4 rounded-b-lg flex justify-between flex-shrink-0 border-t border-gray-200">
          <button
            onClick={onPrev}
            disabled={step === 1}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-gray-800 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>

          <div className="flex gap-2">
            {/* Botão "Salvar e Sair" - aparece em todas as etapas */}
            {(isEditing || isDuplicating || step > 1) && step < 5 && (
              <button
                onClick={onSaveAndExit}
                disabled={!canProceed}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Salvar e Sair
              </button>
            )}

            {step < 5 ? (
              <button
                onClick={onNext}
                disabled={!canProceed}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                Próximo
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => onSubmit(false)}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isDuplicating ? 'Criar Cópia' : isEditing ? 'Salvar Alterações' : 'Criar Turma'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
