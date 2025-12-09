'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario, Institution } from '@/types';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface DashboardData {
  totalOccurrences: number;
  studentsWithOccurrences: number;
  studentsWithoutOccurrences: number;
  totalStudents: number;
  weeklyTrend: number;
  monthlyGrowth: number;
}

interface OccurrencesByClass {
  className: string;
  classId: string;
  count: number;
}

interface OccurrencesByStudent {
  studentName: string;
  studentId: string;
  count: number;
  className: string;
}

interface OccurrencesByType {
  typeName: string;
  typeId: string;
  count: number;
  severity: string;
}

interface MonthlyData {
  month: string;
  count: number;
  change: number; // Mudança absoluta para waterfall
}

interface TopTeachers {
  teacherName: string;
  teacherId: string;
  count: number;
}

interface StudentsWithoutOccurrences {
  studentName: string;
  studentId: string;
  className: string;
  classId: string;
}

interface DayOfWeekData {
  day: string;
  count: number;
  percentChange?: number; // Variação percentual em relação ao dia anterior
  date?: string; // Data específica (para modo semana)
}

interface OccurrencesByShift {
  shift: string;
  shiftLabel: string;
  count: number;
}

interface OccurrencesByEducationLevel {
  level: string;
  levelLabel: string;
  count: number;
}

export default function DashboardOcorrenciasPage() {
  const router = useRouter();
  const [user, setUser] = useState<Usuario | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtro de Ano Letivo
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalOccurrences: 0,
    studentsWithOccurrences: 0,
    studentsWithoutOccurrences: 0,
    totalStudents: 0,
    weeklyTrend: 0,
    monthlyGrowth: 0
  });

  const [occurrencesByClass, setOccurrencesByClass] = useState<OccurrencesByClass[]>([]);
  const [occurrencesByStudent, setOccurrencesByStudent] = useState<OccurrencesByStudent[]>([]);
  const [occurrencesByType, setOccurrencesByType] = useState<OccurrencesByType[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topTeachers, setTopTeachers] = useState<TopTeachers[]>([]);
  const [studentsWithoutOccurrences, setStudentsWithoutOccurrences] = useState<StudentsWithoutOccurrences[]>([]);
  const [dayOfWeekData, setDayOfWeekData] = useState<DayOfWeekData[]>([]);
  const [occurrencesByShift, setOccurrencesByShift] = useState<OccurrencesByShift[]>([]);
  const [occurrencesByEducationLevel, setOccurrencesByEducationLevel] = useState<OccurrencesByEducationLevel[]>([]);

  // Controle do gráfico de dia da semana
  const [weekViewMode, setWeekViewMode] = useState<'week' | 'average' | 'month-detail'>('week'); // 'week', 'average' ou 'month-detail'
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    // Iniciar com a segunda-feira da semana atual
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Se domingo, volta 6 dias; senão, vai para segunda
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Controle de visibilidade do gráfico de professores
  const [showTeachersChart, setShowTeachersChart] = useState(false);

  // Menu de configurações
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settings, setSettings] = useState({
    showTeachersData: false,
    compactMode: false,
    showChartValues: true,
    includeSensitiveDataInExport: false
  });

  // Menu de filtros flutuante
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);

  // PHASE 2: Sistema de Cross-Filtering
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{
    month?: { value: string; label: string };
    class?: { value: string; label: string };
    student?: { value: string; label: string };
    occurrenceType?: { value: string; label: string };
    teacher?: { value: string; label: string };
    specificDate?: { value: string; label: string }; // Filtro por data específica (ex: 2025-10-30)
    dayOfWeek?: { value: string; label: string }; // Filtro por dia da semana genérico (ex: todas as quintas)
  }>({});

  // Filtros de data
  const [dateRange, setDateRange] = useState({
    start: `${selectedYear}-01-01`,
    end: `${selectedYear}-12-31`
  });

  // Filtro de intervalo de datas personalizado (opcional)
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

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
        await loadInstitution(userData);
        await loadAvailableYears(userData);
        await loadDashboardData(userData);
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

  // Atualizar range de datas quando o ano ou datas customizadas mudam
  useEffect(() => {
    // Se houver datas customizadas, usar elas; senão usar o ano completo
    if (customStartDate && customEndDate) {
      setDateRange({
        start: customStartDate,
        end: customEndDate
      });
    } else {
      setDateRange({
        start: `${selectedYear}-01-01`,
        end: `${selectedYear}-12-31`
      });
    }
  }, [selectedYear, customStartDate, customEndDate]);

  // Alternar automaticamente para modo 'month-detail' quando houver filtros de mês/aluno
  useEffect(() => {
    if (activeFilters.month && (activeFilters.student || activeFilters.class)) {
      // Se tem filtro de mês + (aluno OU turma), usar modo detalhamento
      if (weekViewMode !== 'month-detail') {
        setWeekViewMode('month-detail');
      }
    } else if (activeFilters.month && weekViewMode === 'month-detail') {
      // Se removeu filtro de aluno/turma mas ainda tem mês, manter detalhamento
      // (não fazer nada, usuário pode trocar manualmente se quiser)
    } else if (!activeFilters.month && !activeFilters.student && !activeFilters.class && weekViewMode === 'month-detail') {
      // Se removeu todos os filtros relevantes, voltar para modo semana
      setWeekViewMode('week');
    }
  }, [activeFilters]);

  // Recarregar dados quando o ano, período, filtros, modo de visualização ou semana mudarem (com debouncing otimizado)
  useEffect(() => {
    if (user) {
      const loadWithFiltering = async () => {
        setIsFiltering(true);
        await loadDashboardData(user);
        setIsFiltering(false);
      };

      // Debouncing reduzido para resposta mais rápida: apenas 50ms
      const timer = setTimeout(() => {
        loadWithFiltering();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [selectedYear, dateRange, activeFilters, weekViewMode, selectedWeekStart]);

  // Fechar menu de filtros ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showFiltersMenu && !target.closest('.filters-menu-container')) {
        setShowFiltersMenu(false);
      }
    };

    if (showFiltersMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFiltersMenu]);

  const loadInstitution = async (userData: Usuario) => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', userData.institution_id)
        .single();

      if (!error && data) {
        setInstitution(data);
      }
    } catch (error) {
      console.error('Erro ao carregar instituição:', error);
    }
  };

  const loadAvailableYears = async (userData: Usuario) => {
    try {
      const { data } = await supabase
        .from('classes')
        .select('academic_year')
        .eq('institution_id', userData.institution_id);

      if (data) {
        const years = Array.from(new Set(data.map(c => c.academic_year))).sort((a, b) => b - a);
        setAvailableYears(years);
      }
    } catch (error) {
      console.error('Erro ao carregar anos disponíveis:', error);
    }
  };

  // PHASE 2: Funções de gerenciamento de filtros
  const addFilter = (filterType: keyof typeof activeFilters, value: string, label: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterType]: { value, label }
    }));
  };

  const removeFilter = (filterType: keyof typeof activeFilters) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[filterType];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setActiveFilters({});
  };

  // Helper para obter ícone do filtro
  const getFilterIcon = (filterType: keyof typeof activeFilters) => {
    const icons = {
      month: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      class: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      student: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      occurrenceType: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      teacher: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      specificDate: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      dayOfWeek: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    };
    return icons[filterType] || null;
  };

  // Helper para obter nome legível do tipo de filtro
  const getFilterTypeName = (filterType: keyof typeof activeFilters) => {
    const names = {
      month: 'Mês',
      class: 'Turma',
      student: 'Aluno',
      occurrenceType: 'Tipo',
      teacher: 'Professor',
      specificDate: 'Data',
      dayOfWeek: 'Dia da Semana',
    };
    return names[filterType] || filterType;
  };

  // Helper para obter cor do chip baseado no tipo de filtro
  const getFilterColor = (filterType: keyof typeof activeFilters) => {
    const colors = {
      month: 'bg-blue-100 text-blue-800 border-blue-200',
      class: 'bg-purple-100 text-purple-800 border-purple-200',
      student: 'bg-green-100 text-green-800 border-green-200',
      occurrenceType: 'bg-orange-100 text-orange-800 border-orange-200',
      teacher: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      specificDate: 'bg-pink-100 text-pink-800 border-pink-200',
      dayOfWeek: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    };
    return colors[filterType] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const hasActiveFilters = () => {
    return Object.keys(activeFilters).length > 0;
  };

  // PHASE 2: Event handlers para gráficos (memoizados)
  const onMonthlyChartClick = useCallback((params: any) => {
    const monthIndex = params.dataIndex;
    const monthData = monthlyData[monthIndex];
    const monthValue = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    addFilter('month', monthValue, monthData.month);
  }, [monthlyData, selectedYear]);

  const onClassChartClick = useCallback((params: any) => {
    const classData = occurrencesByClass.find(c => c.className === params.name);
    if (classData) {
      addFilter('class', classData.classId, classData.className);
    }
  }, [occurrencesByClass]);

  const onStudentChartClick = useCallback((params: any) => {
    // O gráfico usa dados invertidos (.reverse()), então buscamos pelo nome na barra clicada
    const studentData = occurrencesByStudent.find(s => s.studentName === params.name);
    if (studentData) {
      addFilter('student', studentData.studentId, studentData.studentName);
    }
  }, [occurrencesByStudent]);

  const onTypeChartClick = useCallback((params: any) => {
    // O gráfico usa dados invertidos (.reverse()), então buscamos pelo nome na barra clicada
    const typeData = occurrencesByType.find(t => t.typeName === params.name);
    if (typeData) {
      addFilter('occurrenceType', typeData.typeId, typeData.typeName);
    }
  }, [occurrencesByType]);

  const onTeacherChartClick = useCallback((params: any) => {
    // O gráfico usa dados invertidos (.reverse()), então buscamos pelo nome na barra clicada
    const teacherData = topTeachers.find(t => t.teacherName === params.name);
    if (teacherData) {
      addFilter('teacher', teacherData.teacherId, teacherData.teacherName);
    }
  }, [topTeachers]);

  const onShiftChartClick = useCallback((params: any) => {
    // params.data contém os dados do slice clicado
    const shiftData = params.data;
    if (shiftData && shiftData.shift) {
      addFilter('shift', shiftData.shift, shiftData.name);
    }
  }, []);

  const onEducationLevelChartClick = useCallback((params: any) => {
    // params.data contém os dados do slice clicado
    const levelData = params.data;
    if (levelData && levelData.level) {
      addFilter('educationLevel', levelData.level, levelData.name);
    }
  }, []);

  const onDayOfWeekChartClick = useCallback((params: any) => {
    const dayName = params.name;
    const dataIndex = params.dataIndex;

    if (dayName && dataIndex !== undefined) {
      if (weekViewMode === 'week' || weekViewMode === 'month-detail') {
        // Modo semana ou detalhamento: filtrar por data específica daquele dia
        const clickedDayData = dayOfWeekData[dataIndex];
        if (clickedDayData?.date) {
          const formattedDate = new Date(clickedDayData.date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          // Remove filtro de dia da semana genérico se existir
          if (activeFilters.dayOfWeek) {
            removeFilter('dayOfWeek');
          }
          addFilter('specificDate', clickedDayData.date, formattedDate);
        }
      } else {
        // Modo média: filtrar por dia da semana genérico (todas as quintas, por exemplo)
        const dayMap: { [key: string]: number } = {
          'Segunda': 1,
          'Terça': 2,
          'Quarta': 3,
          'Quinta': 4,
          'Sexta': 5
        };
        const dayNumber = dayMap[dayName];
        if (dayNumber) {
          // Remove filtro de data específica se existir
          if (activeFilters.specificDate) {
            removeFilter('specificDate');
          }
          addFilter('dayOfWeek', dayNumber.toString(), dayName);
        }
      }
    }
  }, [weekViewMode, dayOfWeekData, activeFilters]);

  // Funções de navegação de semana
  const goToPreviousWeek = () => {
    const newDate = new Date(selectedWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setSelectedWeekStart(monday);
  };

  const isCurrentWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + diff);
    currentMonday.setHours(0, 0, 0, 0);

    return selectedWeekStart.getTime() === currentMonday.getTime();
  };

  const handleDateSelect = (dateString: string) => {
    const selectedDate = new Date(dateString);
    const dayOfWeek = selectedDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Se domingo, volta 6 dias; senão, vai para segunda
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setSelectedWeekStart(monday);
  };

  // Helper para formatar data no formato YYYY-MM-DD sem problemas de timezone
  const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper para aplicar filtros ativos nas queries
  const applyActiveFilters = (query: any) => {
    let filteredQuery = query;

    // Filtro por mês (ajusta dateRange)
    if (activeFilters.month) {
      const monthValue = activeFilters.month.value; // formato: "2025-01" (ano-mês)
      const [year, month] = monthValue.split('-');
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

      filteredQuery = filteredQuery
        .gte('occurred_at', monthStart.toISOString())
        .lte('occurred_at', monthEnd.toISOString());
    }

    // Filtro por turma
    if (activeFilters.class) {
      filteredQuery = filteredQuery.eq('class_id', activeFilters.class.value);
    }

    // Filtro por aluno
    if (activeFilters.student) {
      filteredQuery = filteredQuery.eq('student_id', activeFilters.student.value);
    }

    // Filtro por tipo de ocorrência
    if (activeFilters.occurrenceType) {
      filteredQuery = filteredQuery.eq('occurrence_type_id', activeFilters.occurrenceType.value);
    }

    // Filtro por professor
    if (activeFilters.teacher) {
      filteredQuery = filteredQuery.eq('teacher_id', activeFilters.teacher.value);
    }

    // NOTA: Filtro de data específica (specificDate) é aplicado apenas no cliente via filterByDayOfWeek
    // para evitar problemas de timezone. Não aplicar no servidor.

    return filteredQuery;
  };

  // Helper para filtrar dados por dia da semana ou data específica no lado do cliente
  const filterByDayOfWeek = (data: any[]) => {
    if (!data) return data;

    // Filtro por data específica tem prioridade
    if (activeFilters.specificDate) {
      const targetDate = activeFilters.specificDate.value; // formato: "2025-10-30"
      return data.filter(item => {
        if (!item.occurred_at) return false;
        const itemDate = new Date(item.occurred_at);
        const itemDateStr = formatDateToYYYYMMDD(itemDate);
        return itemDateStr === targetDate;
      });
    }

    // Filtro por dia da semana genérico
    if (activeFilters.dayOfWeek) {
      const targetDay = parseInt(activeFilters.dayOfWeek.value);
      return data.filter(item => {
        if (!item.occurred_at) return false;
        const date = new Date(item.occurred_at);
        return date.getDay() === targetDay;
      });
    }

    return data;
  };

  const loadDashboardData = async (userData: Usuario) => {
    if (!userData?.institution_id) return;

    try {
      const { start, end } = dateRange;

      // Buscar turmas do ano selecionado
      let classesQuery = supabase
        .from('classes')
        .select('id, shift, education_level')
        .eq('institution_id', userData.institution_id)
        .eq('academic_year', selectedYear);

      // Aplicar filtro por turno se ativo
      if (activeFilters.shift) {
        classesQuery = classesQuery.eq('shift', activeFilters.shift.value);
      }

      // Aplicar filtro por nível educacional se ativo
      if (activeFilters.educationLevel) {
        classesQuery = classesQuery.eq('education_level', activeFilters.educationLevel.value);
      }

      const { data: classesData } = await classesQuery;

      const classIds = classesData?.map(c => c.id) || [];

      if (classIds.length === 0) {
        // Resetar dados se não houver turmas
        setDashboardData({
          totalOccurrences: 0,
          studentsWithOccurrences: 0,
          studentsWithoutOccurrences: 0,
          totalStudents: 0,
          weeklyTrend: 0,
          monthlyGrowth: 0
        });
        setOccurrencesByClass([]);
        setOccurrencesByStudent([]);
        setOccurrencesByType([]);
        setMonthlyData([]);
        setTopTeachers([]);
        setStudentsWithoutOccurrences([]);
        setDayOfWeekData([]);
        return;
      }

      // 1. KPIs principais com filtros aplicados
      // Se houver filtro de dia da semana ou data específica, precisamos buscar os dados completos para filtrar no cliente
      const hasDayOfWeekFilter = !!activeFilters.dayOfWeek || !!activeFilters.specificDate;

      let occurrencesQuery = supabase
        .from('occurrences')
        .select(hasDayOfWeekFilter ? 'occurred_at' : '*', { count: 'exact', head: !hasDayOfWeekFilter })
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      // Aplicar filtros de data se não houver filtro de mês (filtro de mês sobrescreve)
      if (!activeFilters.month) {
        occurrencesQuery = occurrencesQuery
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      occurrencesQuery = applyActiveFilters(occurrencesQuery);

      let studentsQuery = supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      // Aplicar filtro de turma se ativo
      if (activeFilters.class) {
        studentsQuery = studentsQuery.eq('class_id', activeFilters.class.value);
      }

      const [occurrencesResult, studentsResult] = await Promise.all([
        occurrencesQuery,
        studentsQuery
      ]);

      // Calcular total de ocorrências (com filtro de dia da semana se necessário)
      let currentOccurrences = 0;
      if (hasDayOfWeekFilter) {
        const filteredOccurrences = filterByDayOfWeek(occurrencesResult.data || []);
        currentOccurrences = filteredOccurrences.length;
      } else {
        currentOccurrences = occurrencesResult.count || 0;
      }

      // Alunos com ocorrências (com filtros)
      let studentsOccurrencesQuery = supabase
        .from('occurrences')
        .select('student_id, occurred_at')
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      if (!activeFilters.month) {
        studentsOccurrencesQuery = studentsOccurrencesQuery
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      studentsOccurrencesQuery = applyActiveFilters(studentsOccurrencesQuery);

      const { data: studentsWithOccurrencesData } = await studentsOccurrencesQuery;

      // Aplicar filtro de dia da semana
      const filteredStudentsOccurrences = filterByDayOfWeek(studentsWithOccurrencesData || []);

      const uniqueStudentsWithOccurrences = new Set(
        filteredStudentsOccurrences?.map(o => o.student_id) || []
      ).size;

      const totalStudents = studentsResult.count || 0;

      setDashboardData({
        totalOccurrences: currentOccurrences,
        studentsWithOccurrences: uniqueStudentsWithOccurrences,
        studentsWithoutOccurrences: totalStudents - uniqueStudentsWithOccurrences,
        totalStudents: totalStudents,
        weeklyTrend: 0,
        monthlyGrowth: 0
      });

      // 2. Carregar dados dos gráficos
      await Promise.all([
        loadOccurrencesByClass(userData, classIds),
        loadOccurrencesByStudent(userData, classIds),
        loadOccurrencesByType(userData, classIds),
        loadMonthlyData(userData, classIds),
        loadTopTeachers(userData, classIds),
        loadStudentsWithoutOccurrences(userData, classIds),
        loadDayOfWeekData(userData, classIds),
        loadOccurrencesByShift(userData, classIds),
        loadOccurrencesByEducationLevel(userData, classIds)
      ]);

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      toast.error('Erro ao carregar dados do dashboard');
    }
  };

  const loadOccurrencesByClass = async (userData: Usuario, classIds: string[]) => {
    try {
      const { start, end } = dateRange;

      let query = supabase
        .from('occurrences')
        .select(`
          class_id,
          occurred_at,
          classes!inner(name)
        `)
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      if (!activeFilters.month) {
        query = query
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      query = applyActiveFilters(query);

      const { data } = await query;

      // Aplicar filtro de dia da semana no lado do cliente
      const filteredData = filterByDayOfWeek(data || []);

      const classOccurrences: { [key: string]: { name: string; count: number; id: string } } = {};

      filteredData?.forEach(occurrence => {
        const classId = occurrence.class_id;
        const className = (occurrence.classes as any)?.name || 'Sem turma';

        if (!classOccurrences[classId]) {
          classOccurrences[classId] = { name: className, count: 0, id: classId };
        }
        classOccurrences[classId].count++;
      });

      const classesData = Object.values(classOccurrences).map(cls => ({
        className: cls.name,
        classId: cls.id,
        count: cls.count
      }));

      setOccurrencesByClass(classesData.sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('Erro ao carregar ocorrências por turma:', error);
    }
  };

  const loadOccurrencesByStudent = async (userData: Usuario, classIds: string[]) => {
    try {
      const { start, end } = dateRange;

      // Buscar ocorrências agrupadas por aluno (com filtros)
      let query = supabase
        .from('occurrences')
        .select(`
          student_id,
          occurred_at,
          students!student_id(name)
        `)
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      if (!activeFilters.month) {
        query = query
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      query = applyActiveFilters(query);

      const { data } = await query;

      // Aplicar filtro de dia da semana no lado do cliente
      const filteredData = filterByDayOfWeek(data || []);

      const studentOccurrences: { [key: string]: { name: string; count: number; id: string } } = {};

      filteredData?.forEach(occurrence => {
        const studentId = occurrence.student_id;
        const studentName = (occurrence.students as any)?.name || `Aluno ${studentId}`;

        if (!studentOccurrences[studentId]) {
          studentOccurrences[studentId] = { name: studentName, count: 0, id: studentId };
        }
        studentOccurrences[studentId].count++;
      });

      // Buscar turma ATUAL de cada aluno (não a turma da ocorrência)
      const studentIds = Object.keys(studentOccurrences);
      const { data: studentsWithClasses } = await supabase
        .from('students')
        .select(`
          id,
          class_id,
          classes!class_id(name)
        `)
        .in('id', studentIds);

      // Mapear turmas atuais
      const studentCurrentClass: { [key: string]: string } = {};
      studentsWithClasses?.forEach(student => {
        studentCurrentClass[student.id] = (student.classes as any)?.name || 'Sem turma';
      });

      // Lista completa de alunos (sem limite Top 10), ordenada por quantidade de ocorrências
      const studentsData = Object.values(studentOccurrences)
        .sort((a, b) => b.count - a.count) // Mais ocorrências primeiro
        .map(student => ({
          studentName: student.name,
          studentId: student.id,
          count: student.count,
          className: studentCurrentClass[student.id] || 'Sem turma' // Turma ATUAL
        }));

      setOccurrencesByStudent(studentsData);
    } catch (error) {
      console.error('Erro ao carregar ocorrências por aluno:', error);
    }
  };

  const loadOccurrencesByType = async (userData: Usuario, classIds: string[]) => {
    try {
      const { start, end } = dateRange;

      let query = supabase
        .from('occurrences')
        .select(`
          occurrence_type_id,
          occurred_at,
          occurrence_types!inner(name, severity)
        `)
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      if (!activeFilters.month) {
        query = query
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      query = applyActiveFilters(query);

      const { data } = await query;

      // Aplicar filtro de dia da semana no lado do cliente
      const filteredData = filterByDayOfWeek(data || []);

      const typeOccurrences: { [key: string]: { name: string; count: number; id: string; severity: string } } = {};

      filteredData?.forEach(occurrence => {
        const typeId = occurrence.occurrence_type_id;
        const typeName = (occurrence.occurrence_types as any)?.name || 'Sem tipo';
        const severity = (occurrence.occurrence_types as any)?.severity || 'leve';

        if (!typeOccurrences[typeId]) {
          typeOccurrences[typeId] = { name: typeName, count: 0, id: typeId, severity };
        }
        typeOccurrences[typeId].count++;
      });

      const typesData = Object.values(typeOccurrences).map(type => ({
        typeName: type.name,
        typeId: type.id,
        count: type.count,
        severity: type.severity
      }));

      setOccurrencesByType(typesData.sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('Erro ao carregar ocorrências por tipo:', error);
    }
  };

  const loadMonthlyData = async (userData: Usuario, classIds: string[]) => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-11

      const months = [];

      // Se houver filtro de período personalizado, usar apenas os meses dentro desse intervalo
      if (customStartDate && customEndDate) {
        const customStart = new Date(customStartDate);
        const customEnd = new Date(customEndDate);

        const startYear = customStart.getFullYear();
        const startMonth = customStart.getMonth();
        const endYear = customEnd.getFullYear();
        const endMonth = customEnd.getMonth();

        // Gerar meses dentro do intervalo personalizado
        let currentDate = new Date(startYear, startMonth, 1);
        let monthIndex = 0;

        while (currentDate <= customEnd) {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();

          let startOfPeriod: Date;
          let endOfPeriod: Date;

          // Primeiro mês: usar a data customizada de início
          if (monthIndex === 0) {
            startOfPeriod = new Date(customStart);
            startOfPeriod.setHours(0, 0, 0, 0);
          } else {
            startOfPeriod = new Date(year, month, 1);
          }

          // Último mês: usar a data customizada de fim
          if (year === endYear && month === endMonth) {
            endOfPeriod = new Date(customEnd);
            endOfPeriod.setHours(23, 59, 59, 999);
          } else {
            endOfPeriod = new Date(year, month + 1, 0, 23, 59, 59, 999);
          }

          months.push({
            start: startOfPeriod.toISOString(),
            end: endOfPeriod.toISOString(),
            month: currentDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '') + '/' + year.toString().slice(-2)
          });

          // Avançar para o próximo mês
          currentDate = new Date(year, month + 1, 1);
          monthIndex++;

          // Evitar loop infinito
          if (year === endYear && month === endMonth) break;
        }
      } else {
        // Comportamento padrão: todos os meses do ano até o mês atual
        const maxMonth = selectedYear === currentYear ? currentMonth : 11;

        for (let i = 0; i <= maxMonth; i++) {
          const startMonth = new Date(selectedYear, i, 1);
          const endMonth = new Date(selectedYear, i + 1, 0);

          months.push({
            start: startMonth.toISOString(),
            end: endMonth.toISOString(),
            month: startMonth.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')
          });
        }
      }

      const hasDateFilters = !!activeFilters.specificDate || !!activeFilters.dayOfWeek;

      const monthlyResults = await Promise.all(
        months.map(async ({ start, end, month }) => {
          // Se houver filtros de data, precisamos buscar os dados completos para filtrar no cliente
          let query = supabase
            .from('occurrences')
            .select(hasDateFilters ? 'occurred_at' : '*', { count: 'exact', head: !hasDateFilters })
            .eq('institution_id', userData.institution_id)
            .in('class_id', classIds)
            .gte('occurred_at', start)
            .lte('occurred_at', end);

          // Aplicar filtros exceto mês (o gráfico mensal mostra todos os meses)
          if (activeFilters.class) {
            query = query.eq('class_id', activeFilters.class.value);
          }
          if (activeFilters.student) {
            query = query.eq('student_id', activeFilters.student.value);
          }
          if (activeFilters.occurrenceType) {
            query = query.eq('occurrence_type_id', activeFilters.occurrenceType.value);
          }
          if (activeFilters.teacher) {
            query = query.eq('teacher_id', activeFilters.teacher.value);
          }

          // Executar query
          if (hasDateFilters) {
            const { data } = await query;
            const filteredData = filterByDayOfWeek(data || []);
            return {
              month,
              count: filteredData.length
            };
          } else {
            const { count } = await query;
            return {
              month,
              count: count || 0
            };
          }
        })
      );

      // Calcular mudanças para gráfico (mantido por compatibilidade)
      const waterfallData: MonthlyData[] = monthlyResults.map((current, index) => {
        const change = index === 0 ? current.count : current.count - monthlyResults[index - 1].count;
        return {
          month: current.month,
          count: current.count,
          change
        };
      });

      setMonthlyData(waterfallData);
    } catch (error) {
      console.error('Erro ao carregar dados mensais:', error);
    }
  };

  const loadTopTeachers = async (userData: Usuario, classIds: string[]) => {
    try {
      const { start, end } = dateRange;

      let query = supabase
        .from('occurrences')
        .select(`
          teacher_id,
          occurred_at,
          users!teacher_id(name)
        `)
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      if (!activeFilters.month) {
        query = query
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      query = applyActiveFilters(query);

      const { data } = await query;

      // Aplicar filtro de dia da semana no lado do cliente
      const filteredData = filterByDayOfWeek(data || []);

      const teacherOccurrences: { [key: string]: { name: string; count: number; id: string } } = {};

      filteredData?.forEach(occurrence => {
        const teacherId = occurrence.teacher_id;
        const teacherName = (occurrence.users as any)?.name || `Professor ${teacherId}`;

        if (!teacherOccurrences[teacherId]) {
          teacherOccurrences[teacherId] = { name: teacherName, count: 0, id: teacherId };
        }
        teacherOccurrences[teacherId].count++;
      });

      // Lista completa de professores (sem limite Top 5), ordenada por quantidade de registros
      const teachersData = Object.values(teacherOccurrences)
        .sort((a, b) => b.count - a.count) // Mais registros primeiro
        .map(teacher => ({
          teacherName: teacher.name,
          teacherId: teacher.id,
          count: teacher.count
        }));

      setTopTeachers(teachersData);
    } catch (error) {
      console.error('Erro ao carregar top professores:', error);
    }
  };

  const loadStudentsWithoutOccurrences = async (userData: Usuario, classIds: string[]) => {
    try {
      const { start, end } = dateRange;

      let allStudentsQuery = supabase
        .from('students')
        .select(`
          id,
          name,
          class_id,
          classes!inner(name)
        `)
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds)
        .not('class_id', 'is', null);

      // Aplicar filtro de turma se ativo
      if (activeFilters.class) {
        allStudentsQuery = allStudentsQuery.eq('class_id', activeFilters.class.value);
      }

      const { data: allStudents } = await allStudentsQuery;

      let occurrencesQuery = supabase
        .from('occurrences')
        .select('student_id, occurred_at')
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      if (!activeFilters.month) {
        occurrencesQuery = occurrencesQuery
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      occurrencesQuery = applyActiveFilters(occurrencesQuery);

      const { data: studentsWithOccurrences } = await occurrencesQuery;

      // Aplicar filtro de dia da semana
      const filteredStudentsWithOccurrences = filterByDayOfWeek(studentsWithOccurrences || []);

      const studentsWithOccurrencesIds = new Set(
        filteredStudentsWithOccurrences?.map(o => o.student_id) || []
      );

      const studentsWithoutOccurrencesData = allStudents
        ?.filter(student => !studentsWithOccurrencesIds.has(student.id))
        .map(student => ({
          studentName: student.name,
          studentId: student.id,
          className: (student.classes as any)?.name || 'Sem turma',
          classId: student.class_id
        })) || [];

      setStudentsWithoutOccurrences(studentsWithoutOccurrencesData);
    } catch (error) {
      console.error('Erro ao carregar alunos sem ocorrências:', error);
    }
  };

  const loadDayOfWeekData = async (userData: Usuario, classIds: string[]) => {
    try {
      if (weekViewMode === 'week') {
        // Modo: Semana específica
        const weekStart = new Date(selectedWeekStart);
        const weekEnd = new Date(selectedWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 4); // Segunda a Sexta (5 dias)
        weekEnd.setHours(23, 59, 59, 999);

        let query = supabase
          .from('occurrences')
          .select('occurred_at')
          .eq('institution_id', userData.institution_id)
          .in('class_id', classIds)
          .gte('occurred_at', weekStart.toISOString())
          .lte('occurred_at', weekEnd.toISOString());

        query = applyActiveFilters(query);

        const { data } = await query;

        // Contar ocorrências por dia específico da semana
        const dayCount: { [key: string]: number } = {};
        const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

        // Inicializar todos os dias da semana com 0
        for (let i = 0; i < 5; i++) {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + i);
          const dateKey = formatDateToYYYYMMDD(date);
          dayCount[dateKey] = 0;
        }

        data?.forEach(occurrence => {
          const date = new Date(occurrence.occurred_at);
          const dateKey = formatDateToYYYYMMDD(date);
          if (dayCount[dateKey] !== undefined) {
            dayCount[dateKey]++;
          }
        });

        // Criar array com dados e calcular variações
        const dayData: DayOfWeekData[] = [];
        let previousCount = 0;

        for (let i = 0; i < 5; i++) {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + i);
          const dateKey = formatDateToYYYYMMDD(date);
          const count = dayCount[dateKey] || 0;

          let percentChange = 0;
          if (i > 0 && previousCount > 0) {
            percentChange = ((count - previousCount) / previousCount) * 100;
          } else if (i > 0 && previousCount === 0 && count > 0) {
            percentChange = 100;
          }

          dayData.push({
            day: weekDays[i],
            count: count,
            percentChange: i > 0 ? percentChange : undefined,
            date: dateKey
          });

          previousCount = count;
        }

        setDayOfWeekData(dayData);

      } else if (weekViewMode === 'month-detail') {
        // Modo: Detalhamento do mês - mostra todas as datas com ocorrências
        const { start, end } = dateRange;

        let query = supabase
          .from('occurrences')
          .select('occurred_at')
          .eq('institution_id', userData.institution_id)
          .in('class_id', classIds);

        // Aplicar range do mês filtrado ou período completo
        if (activeFilters.month) {
          const [year, month] = activeFilters.month.value.split('-');
          const monthStart = `${year}-${month}-01`;
          const monthEnd = new Date(parseInt(year), parseInt(month), 0).getDate();
          const monthEndDate = `${year}-${month}-${String(monthEnd).padStart(2, '0')}`;
          query = query
            .gte('occurred_at', `${monthStart}T00:00:00.000Z`)
            .lte('occurred_at', `${monthEndDate}T23:59:59.999Z`);
        } else {
          query = query
            .gte('occurred_at', `${start}T00:00:00.000Z`)
            .lte('occurred_at', `${end}T23:59:59.999Z`);
        }

        query = applyActiveFilters(query);

        const { data } = await query;

        // Contar ocorrências por data específica
        const dateCount: { [key: string]: number } = {};

        data?.forEach(occurrence => {
          const date = new Date(occurrence.occurred_at);
          const dateKey = formatDateToYYYYMMDD(date);
          dateCount[dateKey] = (dateCount[dateKey] || 0) + 1;
        });

        // Criar array ordenado com todas as datas que têm ocorrências
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const dayData: DayOfWeekData[] = [];

        // Ordenar datas
        const sortedDates = Object.keys(dateCount).sort();
        let previousCount = 0;

        sortedDates.forEach((dateKey, index) => {
          const date = new Date(dateKey);
          const dayOfWeek = date.getDay();
          const dayName = dayNames[dayOfWeek];
          const count = dateCount[dateKey];

          // Formatar label: "DD/MM Dia"
          const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const label = `${formattedDate} ${dayName}`;

          let percentChange = 0;
          if (index > 0 && previousCount > 0) {
            percentChange = ((count - previousCount) / previousCount) * 100;
          } else if (index > 0 && previousCount === 0 && count > 0) {
            percentChange = 100;
          }

          dayData.push({
            day: label,
            count: count,
            percentChange: index > 0 ? percentChange : undefined,
            date: dateKey
          });

          previousCount = count;
        });

        setDayOfWeekData(dayData);

      } else {
        // Modo: Média por dia da semana
        const { start, end } = dateRange;

        let query = supabase
          .from('occurrences')
          .select('occurred_at')
          .eq('institution_id', userData.institution_id)
          .in('class_id', classIds);

        if (!activeFilters.month) {
          query = query
            .gte('occurred_at', `${start}T00:00:00.000Z`)
            .lte('occurred_at', `${end}T23:59:59.999Z`);
        }

        query = applyActiveFilters(query);

        const { data } = await query;

        // Contar ocorrências por dia da semana e número de semanas
        const dayCount: { [key: string]: number } = {
          'Segunda': 0,
          'Terça': 0,
          'Quarta': 0,
          'Quinta': 0,
          'Sexta': 0
        };

        const weeksPerDay: { [key: string]: Set<string> } = {
          'Segunda': new Set(),
          'Terça': new Set(),
          'Quarta': new Set(),
          'Quinta': new Set(),
          'Sexta': new Set()
        };

        data?.forEach(occurrence => {
          const date = new Date(occurrence.occurred_at);
          const dayOfWeek = date.getDay();

          // Ignorar fins de semana
          if (dayOfWeek === 0 || dayOfWeek === 6) return;

          const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          const dayName = dayNames[dayOfWeek];

          // Incrementar contador
          dayCount[dayName]++;

          // Rastrear semanas únicas (formato: ano-semana)
          const weekNumber = getWeekNumber(date);
          weeksPerDay[dayName].add(weekNumber);
        });

        // Calcular médias
        const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
        const dayData: DayOfWeekData[] = [];
        let previousAvg = 0;

        weekDays.forEach((day, index) => {
          const totalOccurrences = dayCount[day];
          const numWeeks = weeksPerDay[day].size || 1;
          const average = totalOccurrences / numWeeks;

          let percentChange = 0;
          if (index > 0 && previousAvg > 0) {
            percentChange = ((average - previousAvg) / previousAvg) * 100;
          } else if (index > 0 && previousAvg === 0 && average > 0) {
            percentChange = 100;
          }

          dayData.push({
            day,
            count: Math.round(average * 10) / 10, // Arredondar para 1 casa decimal
            percentChange: index > 0 ? percentChange : undefined
          });

          previousAvg = average;
        });

        setDayOfWeekData(dayData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados por dia da semana:', error);
    }
  };

  // Helper para calcular número da semana no ano
  const getWeekNumber = (date: Date): string => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
  };

  const loadOccurrencesByShift = async (userData: Usuario, classIds: string[]) => {
    try {
      const { start, end } = dateRange;

      let query = supabase
        .from('occurrences')
        .select(`
          class_id,
          occurred_at,
          classes!inner(shift)
        `)
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      if (!activeFilters.month) {
        query = query
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      query = applyActiveFilters(query);

      const { data } = await query;

      // Aplicar filtro de dia da semana no lado do cliente
      const filteredData = filterByDayOfWeek(data || []);

      const shiftCount: { [key: string]: number } = {};

      filteredData?.forEach(occurrence => {
        const shift = (occurrence.classes as any)?.shift || 'Não informado';
        shiftCount[shift] = (shiftCount[shift] || 0) + 1;
      });

      const shiftLabels: { [key: string]: string } = {
        'matutino': 'Matutino',
        'vespertino': 'Vespertino',
        'noturno': 'Noturno',
        'integral': 'Integral',
        'Não informado': 'Não informado'
      };

      const shiftData = Object.entries(shiftCount).map(([shift, count]) => ({
        shift,
        shiftLabel: shiftLabels[shift] || shift,
        count
      }));

      setOccurrencesByShift(shiftData.sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('Erro ao carregar ocorrências por turno:', error);
    }
  };

  const loadOccurrencesByEducationLevel = async (userData: Usuario, classIds: string[]) => {
    try {
      const { start, end } = dateRange;

      let query = supabase
        .from('occurrences')
        .select(`
          class_id,
          occurred_at,
          classes!inner(education_level)
        `)
        .eq('institution_id', userData.institution_id)
        .in('class_id', classIds);

      if (!activeFilters.month) {
        query = query
          .gte('occurred_at', `${start}T00:00:00.000Z`)
          .lte('occurred_at', `${end}T23:59:59.999Z`);
      }

      query = applyActiveFilters(query);

      const { data } = await query;

      // Aplicar filtro de dia da semana no lado do cliente
      const filteredData = filterByDayOfWeek(data || []);

      const levelCount: { [key: string]: number } = {};

      filteredData?.forEach(occurrence => {
        const level = (occurrence.classes as any)?.education_level || 'Não informado';
        levelCount[level] = (levelCount[level] || 0) + 1;
      });

      const levelLabels: { [key: string]: string } = {
        'creche': 'Creche (0-3 anos)',
        'pre_escola': 'Pré-escola (4-5 anos)',
        'fundamental': 'Ensino Fundamental',
        'ensino_medio': 'Ensino Médio',
        'Não informado': 'Não informado'
      };

      const levelData = Object.entries(levelCount).map(([level, count]) => ({
        level,
        levelLabel: levelLabels[level] || level,
        count
      }));

      setOccurrencesByEducationLevel(levelData.sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('Erro ao carregar ocorrências por nível educacional:', error);
    }
  };

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const kpiData = [
        ['Métrica', 'Valor'],
        ['Ano Letivo', selectedYear],
        ['Total de Ocorrências', dashboardData.totalOccurrences],
        ['Alunos com Ocorrências', dashboardData.studentsWithOccurrences],
        ['Alunos sem Ocorrências', dashboardData.studentsWithoutOccurrences],
        ['Total de Alunos', dashboardData.totalStudents],
        ['Taxa de Alunos com Ocorrências', `${((dashboardData.studentsWithOccurrences / dashboardData.totalStudents) * 100).toFixed(1)}%`],
        ['Período', `${dateRange.start} a ${dateRange.end}`]
      ];

      const kpiWs = XLSX.utils.aoa_to_sheet(kpiData);
      XLSX.utils.book_append_sheet(wb, kpiWs, 'KPIs');

      const classesData = [
        ['Turma', 'Quantidade de Ocorrências'],
        ...occurrencesByClass.map(item => [item.className, item.count])
      ];

      const classesWs = XLSX.utils.aoa_to_sheet(classesData);
      XLSX.utils.book_append_sheet(wb, classesWs, 'Ocorrências por Turma');

      const studentsData = [
        ['Aluno', 'Turma', 'Quantidade de Ocorrências'],
        ...occurrencesByStudent.map(item => [item.studentName, item.className, item.count])
      ];

      const studentsWs = XLSX.utils.aoa_to_sheet(studentsData);
      XLSX.utils.book_append_sheet(wb, studentsWs, 'Top Alunos');

      const typesData = [
        ['Tipo de Ocorrência', 'Gravidade', 'Quantidade'],
        ...occurrencesByType.map(item => [item.typeName, item.severity, item.count])
      ];

      const typesWs = XLSX.utils.aoa_to_sheet(typesData);
      XLSX.utils.book_append_sheet(wb, typesWs, 'Tipos de Ocorrências');

      const now = new Date();
      const institutionName = (institution?.nome || institution?.name || 'Instituicao').replace(/\s/g, '_');
      const fileName = `Dashboard_Ocorrencias_${institutionName}_${selectedYear}_${now.toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);

      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      toast.error('Erro ao exportar dados para Excel');
    }
  };

  // ECharts Options (memoizadas para evitar re-renders)

  // 1. Column Chart - Evolução Mensal com Variações Percentuais - CLICÁVEL
  const monthlyColumnOption: EChartsOption = useMemo(() => {
    // Calcular variações percentuais mês a mês
    const dataWithVariations = monthlyData.map((d, index) => {
      let variation = null;
      let variationText = '';

      if (index > 0) {
        const previousCount = monthlyData[index - 1].count;
        if (previousCount > 0) {
          const percentChange = ((d.count - previousCount) / previousCount) * 100;
          variation = percentChange;

          const arrow = percentChange > 0 ? '↑' : percentChange < 0 ? '↓' : '→';
          const sign = percentChange > 0 ? '+' : '';
          variationText = `${arrow} ${sign}${percentChange.toFixed(1)}%`;
        } else if (d.count > 0) {
          // Caso especial: de 0 para algo
          variation = 100;
          variationText = '↑ Novo';
        }
      }

      return {
        value: d.count,
        variation,
        variationText
      };
    });

    return {
      // Configuração de animação fluida - INICIAL e UPDATE
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
      animationDelay: (idx: number) => idx * 50,
      // Animações para UPDATES (quando filtros mudam)
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'cubicInOut',
      animationDelayUpdate: (idx: number) => idx * 30,
      title: {
        text: 'Evolução Mensal de Ocorrências',
        subtext: 'Variação % mês a mês • Clique para filtrar',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0];
          const monthData = monthlyData[data.dataIndex];
          const dataPoint = dataWithVariations[data.dataIndex];

          let tooltip = `<strong>${monthData.month}</strong><br/>Total: ${monthData.count} ocorrências`;

          if (dataPoint.variationText) {
            tooltip += `<br/>Variação: <span style="color: ${dataPoint.variation && dataPoint.variation > 0 ? '#ef4444' : '#10b981'}">${dataPoint.variationText}</span>`;
          }

          return tooltip;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: monthlyData.map(d => d.month),
        axisLabel: {
          rotate: 45,
          fontSize: 11
        }
      },
      yAxis: {
        type: 'value',
        name: 'Ocorrências',
        minInterval: 1
      },
      series: [
        {
          name: 'Ocorrências',
          type: 'bar',
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => {
              const dataPoint = dataWithVariations[params.dataIndex];
              return `{count|${params.value}}\n{variation|${dataPoint.variationText || ''}}`;
            },
            fontSize: 11,
            rich: {
              count: {
                fontSize: 12,
                fontWeight: 'bold',
                color: '#1f2937'
              },
              variation: {
                fontSize: 10,
                fontWeight: 'bold',
                lineHeight: 18,
                color: '#6b7280'
              }
            }
          },
          itemStyle: {
            color: (params: any) => {
              const dataPoint = dataWithVariations[params.dataIndex];
              // Sem variação: azul padrão
              if (!dataPoint.variation) return '#3b82f6';
              // Aumento: vermelho gradual
              if (dataPoint.variation > 0) {
                return dataPoint.variation > 50 ? '#dc2626' : '#ef4444';
              }
              // Diminuição: verde gradual
              return dataPoint.variation < -50 ? '#059669' : '#10b981';
            },
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(37, 99, 235, 0.5)'
            }
          },
          data: dataWithVariations.map(d => d.value)
        }
      ]
    };
  }, [monthlyData]);

  // 2. Vertical Column Chart - Ocorrências por Turma (ordem alfabética, cores verde/vermelho)
  const classesByOccurrenceOption: EChartsOption = useMemo(() => {
    // Ordenar turmas alfabeticamente
    const sortedClasses = [...occurrencesByClass].sort((a, b) =>
      a.className.localeCompare(b.className, 'pt-BR')
    );

    // Encontrar min e max para coloração
    const counts = sortedClasses.map(d => d.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    return {
      // Animações fluidas - INICIAL e UPDATE
      animation: true,
      animationDuration: 800,
      animationEasing: 'elasticOut',
      animationDelay: (idx: number) => idx * 30,
      // Animações para UPDATES (quando filtros mudam)
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'cubicInOut',
      animationDelayUpdate: (idx: number) => idx * 25,
      title: {
        text: 'Ocorrências por Turma',
        subtext: 'Ordenado alfabeticamente • Clique para filtrar',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0];
          return `<strong>${data.name}</strong><br/>
                  Ocorrências: ${data.value}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: sortedClasses.map(d => d.className),
        axisLabel: {
          rotate: 45,
          fontSize: 11
        }
      },
      yAxis: {
        type: 'value',
        name: 'Ocorrências',
        minInterval: 1
      },
      series: [
        {
          name: 'Ocorrências',
          type: 'bar',
          data: sortedClasses.map(d => d.count),
          itemStyle: {
            color: (params: any) => {
              const value = params.value;
              // Verde para mínimo, Vermelho para máximo, gradiente para intermediários
              if (value === minCount) return '#10b981'; // Verde
              if (value === maxCount) return '#ef4444'; // Vermelho

              // Gradiente para valores intermediários
              const ratio = (value - minCount) / (maxCount - minCount);
              if (ratio < 0.5) {
                // Verde -> Amarelo
                return `rgb(${Math.round(16 + (234 - 16) * ratio * 2)}, ${Math.round(185 + (179 - 185) * ratio * 2)}, ${Math.round(129 + (68 - 129) * ratio * 2)})`;
              } else {
                // Amarelo -> Vermelho
                return `rgb(${Math.round(234 + (239 - 234) * (ratio - 0.5) * 2)}, ${Math.round(179 + (68 - 179) * (ratio - 0.5) * 2)}, ${Math.round(68 + (68 - 68) * (ratio - 0.5) * 2)})`;
              }
            },
            borderRadius: [4, 4, 0, 0]
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            fontSize: 11
          },
          emphasis: {
            itemStyle: {
              opacity: 0.8,
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowOffsetY: 3
            }
          }
        }
      ]
    };
  }, [occurrencesByClass]);

  // 3. Horizontal Bar - Tipos de Ocorrências - CLICÁVEL
  const typesByOccurrenceOption: EChartsOption = useMemo(() => ({
    // Animações suaves - INICIAL e UPDATE
    animation: true,
    animationDuration: 700,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 40,
    // Animações para UPDATES (quando filtros mudam)
    animationDurationUpdate: 1000,
    animationEasingUpdate: 'cubicInOut',
    animationDelayUpdate: (idx: number) => idx * 35,
    title: {
      text: 'Tipos de Ocorrências',
      subtext: 'Clique para filtrar',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const data = params[0];
        const typeData = occurrencesByType[occurrencesByType.length - 1 - data.dataIndex];
        return `<strong>${typeData.typeName}</strong><br/>
                Gravidade: ${typeData.severity}<br/>
                Ocorrências: ${typeData.count}`;
      }
    },
    grid: {
      left: '20%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: 'Ocorrências'
    },
    yAxis: {
      type: 'category',
      data: occurrencesByType.map(d => d.typeName).reverse(),
      axisLabel: {
        fontSize: 11
      }
    },
    series: [
      {
        name: 'Ocorrências',
        type: 'bar',
        data: occurrencesByType.map((d) => ({
          value: d.count,
          itemStyle: {
            color: d.severity === 'grave' ? '#ef4444' :
                   d.severity === 'moderada' ? '#f97316' : '#22c55e'
          }
        })).reverse(),
        label: {
          show: true,
          position: 'right'
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 3,
            shadowOffsetY: 0
          }
        }
      }
    ]
  }), [occurrencesByType]);

  // 4. Gráfico de Barras - Dias da Semana (com cores dinâmicas)
  const dayOfWeekOption: EChartsOption = useMemo(() => {
    // Encontrar min e max para normalizar cores
    const counts = dayOfWeekData.map(d => d.count);
    const maxCount = Math.max(...counts, 1);
    const minCount = Math.min(...counts, 0);

    // Criar array de valores ordenados para ranking
    const sortedCounts = [...counts].sort((a, b) => a - b);

    // Função para calcular cor baseada no valor (vermelho = alto, verde = baixo)
    const getColorForValue = (value: number): string => {
      if (maxCount === minCount) return '#fbbf24'; // Amarelo se todos iguais

      // Usar ranking ao invés de normalização simples para melhor distribuição de cores
      const rank = sortedCounts.indexOf(value);
      const totalItems = sortedCounts.length;
      const percentile = rank / (totalItems - 1);

      // Distribuição mais granular de cores
      if (percentile >= 0.75) {
        // Top 25% - Vermelho (mais ocorrências)
        return '#ef4444';
      } else if (percentile >= 0.5) {
        // 50-75% - Laranja
        return '#f97316';
      } else if (percentile >= 0.25) {
        // 25-50% - Amarelo
        return '#fbbf24';
      } else {
        // Bottom 25% - Verde (menos ocorrências)
        return '#10b981';
      }
    };

    let titleText = '';
    let subtitleText = '';

    if (weekViewMode === 'week') {
      titleText = `Ocorrências da Semana (${new Date(selectedWeekStart).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${new Date(new Date(selectedWeekStart).setDate(selectedWeekStart.getDate() + 4)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`;
      subtitleText = 'Clique para filtrar por data específica';
    } else if (weekViewMode === 'month-detail') {
      const monthLabel = activeFilters.month?.label || 'Período';
      const studentLabel = activeFilters.student ? ` - ${activeFilters.student.label}` : '';
      titleText = `Ocorrências por Data - ${monthLabel}${studentLabel}`;
      subtitleText = dayOfWeekData.length > 0 ? `${dayOfWeekData.length} dia(s) com ocorrências • Clique para filtrar` : 'Nenhuma ocorrência no período';
    } else {
      titleText = 'Média de Ocorrências por Dia da Semana';
      subtitleText = 'Clique para filtrar por dia da semana';
    }

    return {
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut',
      animationDelay: (idx: number) => idx * 80,
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'cubicInOut',
      title: {
        text: titleText,
        subtext: subtitleText,
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          const dataIndex = params[0].dataIndex;
          const dayData = dayOfWeekData[dataIndex];
          const count = weekViewMode === 'average' ? dayData.count.toFixed(1) : dayData.count;
          const percentChange = dayData.percentChange;

          let tooltip = `<strong>${dayData.day}</strong><br/>`;
          tooltip += `Ocorrências: ${count}<br/>`;

          if (percentChange !== undefined && percentChange !== null) {
            const sign = percentChange >= 0 ? '+' : '';
            const color = percentChange >= 0 ? '#ef4444' : '#10b981';
            tooltip += `<span style="color: ${color}">Variação: ${sign}${percentChange.toFixed(1)}%</span><br/>`;
          }

          if (dayData.date && weekViewMode !== 'month-detail') {
            tooltip += `Data: ${new Date(dayData.date).toLocaleDateString('pt-BR')}`;
          }

          return tooltip;
        }
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '10%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dayOfWeekData.map(d => d.day),
        axisLabel: {
          fontSize: weekViewMode === 'month-detail' ? 10 : 12,
          fontWeight: 'bold',
          color: '#374151',
          rotate: weekViewMode === 'month-detail' && dayOfWeekData.length > 10 ? 45 : 0
        },
        axisLine: {
          lineStyle: {
            color: '#e5e7eb'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: weekViewMode === 'average' ? 'Média de Ocorrências' : 'Ocorrências',
        nameTextStyle: {
          fontSize: 12,
          color: '#6b7280'
        },
        axisLabel: {
          fontSize: 11,
          color: '#6b7280'
        },
        splitLine: {
          lineStyle: {
            color: '#f3f4f6'
          }
        }
      },
      ...(weekViewMode === 'month-detail' && dayOfWeekData.length > 15 ? {
        dataZoom: [
          {
            type: 'slider',
            xAxisIndex: 0,
            start: 0,
            end: Math.min(100, (15 / dayOfWeekData.length) * 100),
            height: 20,
            bottom: 10,
            borderColor: '#ddd',
            fillerColor: 'rgba(59, 130, 246, 0.2)',
            handleStyle: {
              color: '#3b82f6'
            }
          },
          {
            type: 'inside',
            xAxisIndex: 0,
            start: 0,
            end: Math.min(100, (15 / dayOfWeekData.length) * 100),
            zoomOnMouseWheel: true,
            moveOnMouseMove: true
          }
        ]
      } : {}),
      series: [
        {
          name: 'Ocorrências',
          type: 'bar',
          data: dayOfWeekData.map((d) => {
            const baseColor = getColorForValue(d.count);
            const percentChange = d.percentChange;

            return {
              value: d.count,
              itemStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: baseColor },
                    { offset: 1, color: baseColor + 'CC' }
                  ]
                },
                borderRadius: [8, 8, 0, 0]
              },
              label: {
                show: true,
                position: 'top',
                formatter: (params: any) => {
                  const dataIndex = params.dataIndex;
                  const dayData = dayOfWeekData[dataIndex];
                  const count = weekViewMode === 'average' ? dayData.count.toFixed(1) : dayData.count;
                  const percentChange = dayData.percentChange;

                  if (percentChange !== undefined && percentChange !== null) {
                    const sign = percentChange >= 0 ? '+' : '';
                    const arrow = percentChange >= 0 ? '↑' : '↓';
                    return `${count}\n${arrow} ${sign}${percentChange.toFixed(0)}%`;
                  }
                  return count.toString();
                },
                fontSize: 11,
                fontWeight: 'bold',
                color: '#374151',
                lineHeight: 14
              }
            };
          }),
          barWidth: '50%',
          emphasis: {
            itemStyle: {
              shadowBlur: 15,
              shadowOffsetX: 0,
              shadowOffsetY: 5,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            }
          }
        }
      ]
    };
  }, [dayOfWeekData, weekViewMode, selectedWeekStart]);

  // 5. Horizontal Bar - Alunos com Ocorrências (Lista Completa Scrollável) - CLICÁVEL
  const topStudentsOption: EChartsOption = useMemo(() => ({
    // Animação fluida - INICIAL e UPDATE
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 20,
    // Animações para UPDATES (quando filtros mudam)
    animationDurationUpdate: 900,
    animationEasingUpdate: 'cubicInOut',
    animationDelayUpdate: (idx: number) => idx * 15,
    title: {
      text: `Alunos com Ocorrências (${occurrencesByStudent.length})`,
      subtext: 'Ordenado por quantidade - Role para ver todos • Clique para filtrar',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const data = params[0];
        const studentData = occurrencesByStudent[occurrencesByStudent.length - 1 - data.dataIndex];
        return `<strong>${studentData.studentName}</strong><br/>
                Turma: ${studentData.className}<br/>
                Ocorrências: ${studentData.count}`;
      }
    },
    grid: {
      left: '25%',
      right: '8%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: 'Ocorrências'
    },
    yAxis: {
      type: 'category',
      data: occurrencesByStudent.map(d => d.studentName).reverse(),
      axisLabel: {
        fontSize: 11
      }
    },
    dataZoom: [
      {
        type: 'slider',
        yAxisIndex: 0,
        show: true,
        right: 10,
        start: 0,
        end: Math.min(100, (10 / occurrencesByStudent.length) * 100), // Mostra ~10 alunos inicialmente
        width: 20,
        handleSize: '80%',
        showDetail: false
      },
      {
        type: 'inside',
        yAxisIndex: 0,
        start: 0,
        end: Math.min(100, (10 / occurrencesByStudent.length) * 100),
        zoomOnMouseWheel: true,
        moveOnMouseMove: true
      }
    ],
    series: [
      {
        name: 'Ocorrências',
        type: 'bar',
        data: occurrencesByStudent.map(d => d.count).reverse(),
        itemStyle: {
          color: '#f97316'
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 10
        },
        emphasis: {
          itemStyle: {
            color: '#ea580c',
            shadowBlur: 10,
            shadowOffsetX: 3,
            shadowOffsetY: 0
          }
        }
      }
    ]
  }), [occurrencesByStudent]);

  // 6. Horizontal Bar - Professores (Lista Completa Scrollável) - CLICÁVEL
  const topTeachersOption: EChartsOption = useMemo(() => ({
    // Animação fluida - INICIAL e UPDATE
    animation: true,
    animationDuration: 600,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 20,
    // Animações para UPDATES (quando filtros mudam)
    animationDurationUpdate: 900,
    animationEasingUpdate: 'cubicInOut',
    animationDelayUpdate: (idx: number) => idx * 15,
    title: {
      text: `Registros por Professor (${topTeachers.length})`,
      subtext: 'Ordenado por quantidade - Role para ver todos • Clique para filtrar',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '25%',
      right: '8%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: 'Registros'
    },
    yAxis: {
      type: 'category',
      data: topTeachers.map(d => d.teacherName).reverse(),
      axisLabel: {
        fontSize: 11
      }
    },
    dataZoom: [
      {
        type: 'slider',
        yAxisIndex: 0,
        show: true,
        right: 10,
        start: 0,
        end: Math.min(100, (10 / topTeachers.length) * 100), // Mostra ~10 professores inicialmente
        width: 20,
        handleSize: '80%',
        showDetail: false
      },
      {
        type: 'inside',
        yAxisIndex: 0,
        start: 0,
        end: Math.min(100, (10 / topTeachers.length) * 100),
        zoomOnMouseWheel: true,
        moveOnMouseMove: true
      }
    ],
    series: [
      {
        name: 'Registros',
        type: 'bar',
        data: topTeachers.map(d => d.count).reverse(),
        itemStyle: {
          color: '#8b5cf6'
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 10
        },
        emphasis: {
          itemStyle: {
            color: '#7c3aed',
            shadowBlur: 10,
            shadowOffsetX: 3,
            shadowOffsetY: 0
          }
        }
      }
    ]
  }), [topTeachers]);

  // Gráfico por Turno (Donut Chart)
  const occurrencesByShiftOption: EChartsOption = useMemo(() => {
    const shiftColors: { [key: string]: string } = {
      'matutino': '#FCD34D',    // Amarelo/Dourado - Manhã
      'vespertino': '#F97316',  // Laranja - Tarde
      'noturno': '#6366F1',     // Índigo - Noite
      'integral': '#8B5CF6'     // Roxo - Integral
    };

    return {
      animation: true,
      animationDuration: 700,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'cubicInOut',
      title: {
        text: 'Ocorrências por Turno',
        left: 'center',
        top: 10
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle',
        textStyle: {
          fontSize: 12
        }
      },
      series: [
        {
          name: 'Ocorrências',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}\n{c} ({d}%)',
            fontSize: 11
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 15,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.3)'
            }
          },
          data: occurrencesByShift.map(d => ({
            value: d.count,
            name: d.shiftLabel,
            itemStyle: {
              color: shiftColors[d.shift] || '#94A3B8'
            },
            shift: d.shift
          }))
        }
      ]
    };
  }, [occurrencesByShift]);

  // Gráfico por Nível Educacional (Donut Chart)
  const occurrencesByEducationLevelOption: EChartsOption = useMemo(() => {
    const levelColors: { [key: string]: string } = {
      'creche': '#F472B6',        // Rosa - Creche (0-3 anos)
      'pre_escola': '#F9A8D4',    // Rosa claro - Pré-escola (4-5 anos)
      'fundamental': '#60A5FA',   // Azul - Ensino Fundamental
      'ensino_medio': '#A78BFA',  // Roxo - Ensino Médio
      'eja': '#FB923C',           // Laranja - EJA (se existir)
      'tecnico': '#22D3EE',       // Ciano - Técnico (se existir)
      'superior': '#818CF8'       // Índigo - Superior (se existir)
    };

    return {
      animation: true,
      animationDuration: 700,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'cubicInOut',
      title: {
        text: 'Ocorrências por Nível Educacional',
        left: 'center',
        top: 10
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle',
        textStyle: {
          fontSize: 12
        }
      },
      series: [
        {
          name: 'Ocorrências',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}\n{c} ({d}%)',
            fontSize: 11
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 15,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.3)'
            }
          },
          data: occurrencesByEducationLevel.map(d => ({
            value: d.count,
            name: d.levelLabel,
            itemStyle: {
              color: levelColors[d.level] || '#94A3B8'
            },
            level: d.level
          }))
        }
      ]
    };
  }, [occurrencesByEducationLevel]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-blue-600 font-medium">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center py-4 gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => router.push('/admin')}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Voltar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-blue-600 whitespace-nowrap">
                  Dashboard de Ocorrências
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 truncate max-w-[200px] sm:max-w-xs" title={institution?.nome || institution?.name}>
                  {institution?.nome || institution?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 sm:gap-3 justify-end">
              {/* Filtro de Ano Letivo */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:inline">Ano Letivo:</label>
                <label className="text-xs font-medium text-gray-700 whitespace-nowrap sm:hidden">Ano:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
                >
                  {availableYears.length > 0 ? (
                    availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))
                  ) : (
                    [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3]
                      .map(year => <option key={year} value={year}>{year}</option>)
                  )}
                </select>
              </div>

              {/* Divisor */}
              <div className="hidden lg:block w-px h-8 bg-gray-300"></div>

              {/* Filtro de Intervalo de Datas Personalizado */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1 whitespace-nowrap">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Período:
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  placeholder="Data início"
                  className="px-2 py-1 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs w-28 sm:w-32"
                  max={customEndDate || undefined}
                />
                <span className="text-gray-500 text-xs hidden sm:inline">até</span>
                <span className="text-gray-500 text-xs sm:hidden">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  placeholder="Data fim"
                  className="px-2 py-1 sm:py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs w-28 sm:w-32"
                  min={customStartDate || undefined}
                />
                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors flex-shrink-0"
                    title="Limpar filtro de período"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <button
                onClick={exportToExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors flex items-center gap-1.5 sm:gap-2"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Exportar</span>
                <span className="sm:hidden">Excel</span>
              </button>

              {/* Botão de Configurações */}
              <button
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors relative"
                title="Configurações do Dashboard"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              <div className="text-right hidden lg:block">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-blue-600">Administrador</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Painel Lateral de Configurações */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300 z-40 ${
          showSettingsPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowSettingsPanel(false)}
      />

      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          showSettingsPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header do Painel */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Configurações</h2>
            </div>
            <button
              onClick={() => setShowSettingsPanel(false)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Conteúdo do Painel */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Seção: Visualização */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Visualização</h3>
              </div>

              <div className="space-y-3">
                {/* Toggle: Mostrar Dados dos Professores */}
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Dados dos Professores</p>
                      <p className="text-xs text-gray-500">Mostrar gráfico de registros por professor</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showTeachersData}
                    onChange={(e) => {
                      setSettings({ ...settings, showTeachersData: e.target.checked });
                      setShowTeachersChart(e.target.checked);
                    }}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                {/* Toggle: Modo Compacto */}
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 rounded">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Modo Compacto</p>
                      <p className="text-xs text-gray-500">Em breve...</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                {/* Toggle: Mostrar Valores nos Gráficos */}
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 rounded">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Valores nos Gráficos</p>
                      <p className="text-xs text-gray-500">Em breve...</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled
                    checked={settings.showChartValues}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            {/* Seção: Exportação */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Exportação</h3>
              </div>

              <div className="space-y-3">
                {/* Toggle: Incluir Dados Sensíveis */}
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-200 rounded">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Dados Sensíveis</p>
                      <p className="text-xs text-gray-500">Em breve...</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled
                    checked={settings.includeSensitiveDataInExport}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            {/* Seção: Layout (Futuro) */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Layout</h3>
              </div>

              <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-indigo-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-indigo-900 mb-1">Personalização de Layout</p>
                    <p className="text-xs text-indigo-700">
                      Em breve você poderá arrastar e soltar gráficos, redimensionar cards e salvar layouts personalizados.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer do Painel */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setShowSettingsPanel(false)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Aplicar Configurações
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">

        {/* Indicador removido para evitar qualquer flash visual durante animações */}
        {/* As animações dos gráficos já fornecem feedback visual suficiente */}

        {/* Container limpo sem interferências visuais */}
        <div>
          {/* SEÇÃO 1: KPI Cards - Contexto */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Visão Geral - Ano {selectedYear}
            {(customStartDate && customEndDate) && (
              <span className="text-lg font-normal text-gray-600 ml-2">
                ({new Date(customStartDate).toLocaleDateString('pt-BR')} - {new Date(customEndDate).toLocaleDateString('pt-BR')})
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total de Ocorrências</p>
                  <p className="text-2xl font-bold text-gray-900 transition-all duration-500" key={dashboardData.totalOccurrences}>
                    {dashboardData.totalOccurrences}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Alunos com Ocorrências</p>
                  <p className="text-2xl font-bold text-gray-900 transition-all duration-500" key={dashboardData.studentsWithOccurrences}>
                    {dashboardData.studentsWithOccurrences}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Alunos sem Ocorrências</p>
                  <p className="text-2xl font-bold text-gray-900 transition-all duration-500" key={dashboardData.studentsWithoutOccurrences}>
                    {dashboardData.studentsWithoutOccurrences}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 transition-all duration-300 hover:shadow-md">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total de Alunos</p>
                  <p className="text-2xl font-bold text-gray-900 transition-all duration-500" key={dashboardData.totalStudents}>
                    {dashboardData.totalStudents}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: Waterfall Chart - Foco Principal */}
        <div className="mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <ReactECharts
              option={monthlyColumnOption}
              style={{ height: '400px', cursor: 'pointer' }}
              onEvents={{ click: onMonthlyChartClick }}
              notMerge={false}
              lazyUpdate={false}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>

        {/* SEÇÃO 3: Análise por Dimensão */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Análise por Dimensão</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <ReactECharts
                option={classesByOccurrenceOption}
                style={{ height: '350px', cursor: 'pointer' }}
                onEvents={{ click: onClassChartClick }}
                notMerge={false}
                lazyUpdate={false}
                opts={{ renderer: 'canvas' }}
              />
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <ReactECharts
                option={typesByOccurrenceOption}
                style={{ height: '350px', cursor: 'pointer' }}
                onEvents={{ click: onTypeChartClick }}
                notMerge={false}
                lazyUpdate={false}
                opts={{ renderer: 'canvas' }}
              />
            </div>
            {occurrencesByShift.length > 0 && (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <ReactECharts
                  option={occurrencesByShiftOption}
                  style={{ height: '350px', cursor: 'pointer' }}
                  onEvents={{ click: onShiftChartClick }}
                  notMerge={false}
                  lazyUpdate={false}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            )}
            {occurrencesByEducationLevel.length > 0 && (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <ReactECharts
                  option={occurrencesByEducationLevelOption}
                  style={{ height: '350px', cursor: 'pointer' }}
                  onEvents={{ click: onEducationLevelChartClick }}
                  notMerge={false}
                  lazyUpdate={false}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO 4: Padrões Temporais */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Padrões Temporais</h2>

            {/* Toggle: Semana / Média / Detalhamento */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setWeekViewMode('week')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  weekViewMode === 'week'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setWeekViewMode('average')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  weekViewMode === 'average'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Média
              </button>
              <button
                onClick={() => setWeekViewMode('month-detail')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  weekViewMode === 'month-detail'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Mostra todas as datas com ocorrências"
              >
                Detalhamento
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            {/* Controles de navegação de semana (apenas no modo semana) */}
            {weekViewMode === 'week' && (
              <div className="flex flex-col gap-4 mb-6 pb-4 border-b border-gray-200">
                {/* Navegação com setas e botão atual */}
                <div className="flex justify-center items-center gap-4">
                  <button
                    onClick={goToPreviousWeek}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Semana Anterior"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <button
                    onClick={goToCurrentWeek}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isCurrentWeek()
                        ? 'bg-blue-100 text-blue-700 cursor-default'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    disabled={isCurrentWeek()}
                  >
                    {isCurrentWeek() ? 'Semana Atual' : 'Ir para Semana Atual'}
                  </button>

                  <button
                    onClick={goToNextWeek}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Próxima Semana"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Seletor rápido de data */}
                <div className="flex justify-center items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium">Ir para semana de:</span>
                  </label>
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onChange={(e) => handleDateSelect(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    title="Selecione uma data para ir para a semana correspondente"
                  />
                </div>
              </div>
            )}

            {/* Legenda de cores */}
            <div className="flex justify-center items-center gap-4 mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600">Menos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-gray-600">Baixo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-gray-600">Médio</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-gray-600">Mais</span>
              </div>
            </div>

            <ReactECharts
              option={dayOfWeekOption}
              style={{ height: '400px', cursor: 'pointer' }}
              onEvents={{ click: onDayOfWeekChartClick }}
              notMerge={false}
              lazyUpdate={false}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </div>

        {/* SEÇÃO 5: Pessoas Envolvidas */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Pessoas Envolvidas</h2>
          <div className={showTeachersChart ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "flex justify-center"}>
            <div className={showTeachersChart ? "bg-white rounded-lg p-6 shadow-sm border border-gray-200" : "bg-white rounded-lg p-6 shadow-sm border border-gray-200 w-full lg:w-2/3"}>
              <ReactECharts
                option={topStudentsOption}
                style={{ height: '500px', cursor: 'pointer' }}
                onEvents={{ click: onStudentChartClick }}
                notMerge={false}
                lazyUpdate={false}
                opts={{ renderer: 'canvas' }}
              />
            </div>

            {/* Gráfico de Professores - Controlado via Configurações */}
            {showTeachersChart && (
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <ReactECharts
                  option={topTeachersOption}
                  style={{ height: '500px', cursor: 'pointer' }}
                  onEvents={{ click: onTeacherChartClick }}
                  notMerge={false}
                  lazyUpdate={false}
                  opts={{ renderer: 'canvas' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO 6: Destaques Positivos */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Destaques Positivos</h2>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Alunos sem Ocorrências ({studentsWithoutOccurrences.length})
            </h3>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left p-3 font-medium text-gray-600">Turma</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsWithoutOccurrences.length > 0 ? (
                    studentsWithoutOccurrences.map((student, index) => (
                      <tr key={student.studentId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-3 text-gray-900">{student.studentName}</td>
                        <td className="p-3 text-gray-600">{student.className}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-gray-500">
                        Todos os alunos têm pelo menos uma ocorrência no período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        </div> {/* Fim da div de transição de opacidade */}

      </main>

      {/* Botão Flutuante (FAB) para Gerenciar Filtros */}
      {hasActiveFilters() && (
        <div className="fixed bottom-8 right-8 z-50 filters-menu-container">
          {/* Menu de Filtros (aparece quando clica no botão) */}
          {showFiltersMenu && (
            <div className="absolute bottom-20 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-fadeInUp mb-2">
              {/* Cabeçalho do Menu */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <h3 className="font-semibold text-sm">
                    Filtros Ativos ({Object.keys(activeFilters).length})
                  </h3>
                </div>
                <button
                  onClick={() => setShowFiltersMenu(false)}
                  className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Lista de Filtros */}
              <div className="max-h-96 overflow-y-auto">
                {Object.entries(activeFilters).map(([filterType, filterData]) => (
                  <div
                    key={filterType}
                    className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Info do Filtro */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${getFilterColor(filterType as keyof typeof activeFilters)} flex items-center justify-center`}>
                          {getFilterIcon(filterType as keyof typeof activeFilters)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 font-medium">
                            {getFilterTypeName(filterType as keyof typeof activeFilters)}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {filterData.label}
                          </p>
                        </div>
                      </div>

                      {/* Botão Remover */}
                      <button
                        onClick={() => removeFilter(filterType as keyof typeof activeFilters)}
                        className="flex-shrink-0 p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors group"
                        title={`Remover filtro de ${getFilterTypeName(filterType as keyof typeof activeFilters)}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rodapé com Botão Limpar Todos */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={() => {
                    clearAllFilters();
                    setShowFiltersMenu(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium rounded-lg transition-all duration-200 hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Limpar Todos os Filtros
                </button>
              </div>
            </div>
          )}

          {/* Botão Principal (FAB) */}
          <button
            onClick={() => setShowFiltersMenu(!showFiltersMenu)}
            className={`bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full p-4 shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-110 group ${
              showFiltersMenu ? 'ring-4 ring-blue-300' : ''
            }`}
            title="Gerenciar filtros"
          >
            <div className="relative">
              {/* Badge com número de filtros */}
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
                {Object.keys(activeFilters).length}
              </span>

              {/* Ícone de filtro */}
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>

            {/* Tooltip animado */}
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm font-medium px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              {showFiltersMenu ? 'Fechar' : 'Gerenciar'} {Object.keys(activeFilters).length} {Object.keys(activeFilters).length === 1 ? 'filtro' : 'filtros'}
            </span>
          </button>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}
