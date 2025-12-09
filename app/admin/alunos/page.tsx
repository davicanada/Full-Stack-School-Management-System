'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario, Institution } from '@/types';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Class {
  id: string;
  name: string;
  is_active: boolean;
}

interface Student {
  id: string;
  name: string;
  registration_number: string;
  class_id: string;
  institution_id: string;
  is_active: boolean;
  created_at: string;
  classes?: {
    name: string;
  };
  // Campos do sistema de lixeira
  deleted_at?: string | null;
  deleted_by?: string | null;
}

interface StudentFormDate {
  name: string;
  registration_number: string;
  class_id: string;
  is_active: boolean;
}

interface ImportDate {
  name: string;
  registration_number?: string;
  error?: string;
  hasError?: boolean;
  errorMessage?: string;
}

interface DuplicateInfo {
  studentName: string;
  matricula: string;
  existingStudentName: string;
  existingClassName: string;
}

interface StudentWithClass {
  registration_number: string;
  name: string;
  classes: {
    name: string;
  } | {
    name: string;
  }[];
}

interface ImportResult {
  imported: number;
  errors: string[];
  duplicateMatriculas: DuplicateInfo[];
}

interface XlsxRow {
  name: string;
  registration_number: string;
}

interface StudentToImport {
  name: string;
  registration_number: string;
  class_id: string;
  institution_id: string;
  is_active: boolean;
}

export default function StudentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<Usuario | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [trashedStudents, setTrashedStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showChangeClassModal, setShowChangeClassModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Form states
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [changingClassStudent, setChangingClassStudent] = useState<Student | null>(null);
  const [newClassId, setNewClassId] = useState<string>('');
  const [formDate, setFormDate] = useState<StudentFormDate>({
    name: '',
    registration_number: '',
    class_id: '',
    is_active: true,
  });

  // Import states
  const [, setImportFile] = useState<File | null>(null);
  const [importClassId, setImportClassId] = useState<string>('');
  const [previewDate, setPreviewDate] = useState<ImportDate[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isValidatingDate, setIsValidatingDate] = useState(false);

  const fetchClasses = useCallback(async (institutionId: string) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error buscar turmas:', error);
        toast.error('Error carregar turmas');
        return;
      }

      setClasses(data || []);
    } catch (error) {
      console.error('Error buscar turmas:', error);
      toast.error('Error carregar turmas');
    }
  }, []);

  const fetchStudents = useCallback(async (institutionId: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(name)')
        .eq('institution_id', institutionId)
        .is('deleted_at', null) // EXCLUIR lixeira
        .order('name');

      if (error) {
        console.error('Error buscar alunos:', error);
        toast.error('Error carregar alunos');
        return;
      }

      setStudents(data || []);
    } catch (error) {
      console.error('Error buscar alunos:', error);
      toast.error('Error carregar alunos');
    }
  }, []);

  const fetchTrashedStudents = useCallback(async (institutionId: string) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(name)')
        .eq('institution_id', institutionId)
        .not('deleted_at', 'is', null) // APENAS lixeira
        .order('deleted_at', { ascending: false });

      if (error) {
        console.error('Error buscar alunos na lixeira:', error);
        toast.error('Error carregar lixeira');
        return;
      }

      setTrashedStudents(data || []);
    } catch (error) {
      console.error('Error buscar alunos na lixeira:', error);
      toast.error('Error carregar lixeira');
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

        const { data: institutionDate, error: institutionError } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', userDate.institution_id)
          .single();

        if (institutionError) {
          toast.error('Error carregar dados da instituição');
        } else {
          setInstitution(institutionDate);
        }

        await Promise.all([
          fetchClasses(userDate.institution_id),
          fetchStudents(userDate.institution_id),
          fetchTrashedStudents(userDate.institution_id)
        ]);
      } catch (error) {
        console.error('Erro na autenticação:', error);
        toast.error('Error verificar autenticação');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, fetchClasses, fetchStudents]);

  useEffect(() => {
    // Filter students when class filter changes
    if (selectedClassFilter === '') {
      setFilteredStudents(students);
    } else {
      setFilteredStudents(students.filter(student => student.class_id === selectedClassFilter));
    }
  }, [students, selectedClassFilter]);

  useEffect(() => {
    // Set initial class filter from URL params
    const turmaParam = searchParams.get('turma');
    if (turmaParam) {
      setSelectedClassFilter(turmaParam);
    }
  }, [searchParams]);

  

  const generateUniqueRegistrationNumbers = async (count: number, existingMatriculas: Set<string>) => {
    const year = new Date().getFullYear();
    const generatedMatriculas: string[] = [];
    const allExistingMatriculas = new Set(Array.from(existingMatriculas));
    
    for (let i = 0; i < count; i++) {
      let matricula: string;
      let counter = 1;
      
      do {
        const baseNumber = String(counter).padStart(3, '0');
        matricula = `${year}${baseNumber}`;
        counter++;
      } while (allExistingMatriculas.has(matricula));
      
      generatedMatriculas.push(matricula);
      allExistingMatriculas.add(matricula);
    }
    
    return generatedMatriculas;
  };

  const generateRegistrationNumber = () => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `${year}${timestamp}`;
  };

  const handleCreateStudent = async () => {
    if (!user) return;

    try {
      if (!formDate.name.trim() || !formDate.class_id) {
        toast.error('Name e turma são obrigatórios');
        return;
      }

      const registrationNumber = formDate.registration_number.trim() || generateRegistrationNumber();

      // Check if registration number already exists
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('registration_number', registrationNumber)
        .eq('institution_id', user.institution_id)
        .single();

      if (existingStudent) {
        toast.error('Número de matrícula já existe');
        return;
      }

      const { error } = await supabase
        .from('students')
        .insert([
          {
            name: formDate.name.trim(),
            registration_number: registrationNumber,
            class_id: formDate.class_id,
            institution_id: user.institution_id,
            is_active: formDate.is_active,
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error criar aluno:', error);
        toast.error('Error criar aluno');
        return;
      }

      toast.success('Student created successfully!');
      setShowModal(false);
      resetForm();
      if (user?.institution_id) {
        await fetchStudents(user.institution_id);
      }
    } catch (error) {
      console.error('Error criar aluno:', error);
      toast.error('Error criar aluno');
    }
  };

  const handleUpdateStudent = async () => {
    if (!user || !editingStudent) return;

    try {
      if (!formDate.name.trim() || !formDate.class_id) {
        toast.error('Name e turma são obrigatórios');
        return;
      }

      const registrationNumber = formDate.registration_number.trim() || generateRegistrationNumber();

      // Check if registration number already exists (excluding current student)
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id')
        .eq('registration_number', registrationNumber)
        .eq('institution_id', user.institution_id)
        .neq('id', editingStudent.id)
        .single();

      if (existingStudent) {
        toast.error('Número de matrícula já existe');
        return;
      }

      const { error } = await supabase
        .from('students')
        .update({
          name: formDate.name.trim(),
          registration_number: registrationNumber,
          class_id: formDate.class_id,
          is_active: formDate.is_active,
        })
        .eq('id', editingStudent.id);

      if (error) {
        console.error('Error atualizar aluno:', error);
        toast.error('Error atualizar aluno');
        return;
      }

      toast.success('Student updated successfully!');
      setShowModal(false);
      setEditingStudent(null);
      resetForm();
      if (user?.institution_id) {
        await fetchStudents(user.institution_id);
      }
    } catch (error) {
      console.error('Error atualizar aluno:', error);
      toast.error('Error atualizar aluno');
    }
  };


  const handleMoveToTrash = async (student: Student) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Are you sure you want to mover ${student.name} para a lixeira?\n\n` +
      `O aluno será desativado automaticamente e poderá ser restaurado depois.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          is_active: false
        })
        .eq('id', student.id);

      if (error) {
        console.error('Error mover aluno para lixeira:', error);
        toast.error('Error mover para lixeira');
        return;
      }

      toast.success(`${student.name} foi movido para a lixeira e desativado`);
      if (user.institution_id) {
        await fetchStudents(user.institution_id);
        await fetchTrashedStudents(user.institution_id);
      }
    } catch (error) {
      console.error('Error mover aluno para lixeira:', error);
      toast.error('Error mover para lixeira');
    }
  };

  const handleRestoreFromTrash = async (student: Student) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Restore ${student.name} da lixeira?\n\n` +
      `O aluno será reativado automaticamente.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({
          deleted_at: null,
          deleted_by: null,
          is_active: true
        })
        .eq('id', student.id);

      if (error) {
        console.error('Error restaurar aluno:', error);
        toast.error('Error restaurar aluno');
        return;
      }

      toast.success(`${student.name} foi restaurado e reativado com sucesso`);
      if (user.institution_id) {
        await fetchStudents(user.institution_id);
        await fetchTrashedStudents(user.institution_id);
      }
    } catch (error) {
      console.error('Error restaurar aluno:', error);
      toast.error('Error restaurar aluno');
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!user) return;

    const confirmDelete = window.confirm(
      `ATENÇÃO: Are you sure you want to EXCLUIR PERMANENTEMENTE ${student.name}?\n\n` +
      `Esta ação NÃO PODE SER DESFEITA.`
    );

    if (!confirmDelete) return;

    try {
      // Verificar se tem ocorrências relacionadas
      const { data: occurrences, error: occurrencesError } = await supabase
        .from('occurrences')
        .select('id')
        .eq('student_id', student.id);

      if (occurrencesError) throw occurrencesError;

      if (occurrences && occurrences.length > 0) {
        toast.error(`No é possível excluir. Existem ${occurrences.length} ocorrência(s) registrada(s) para este aluno.`);
        return;
      }

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);

      if (error) throw error;

      toast.success(`${student.name} foi excluído permanentemente`);
      if (user.institution_id) {
        await fetchStudents(user.institution_id);
        await fetchTrashedStudents(user.institution_id);
      }
    } catch (error) {
      console.error('Error deletar aluno:', error);
      toast.error('Error deletar aluno');
    }
  };

  const handleChangeClass = async () => {
    if (!user || !changingClassStudent || !newClassId) {
      console.error('❌ Dados faltando:', { user, changingClassStudent, newClassId });
      toast.error('Dados incompletos para mudança de turma');
      return;
    }

    try {
      console.log('🔄 Iniciando mudança de turma:', {
        studentId: changingClassStudent.id,
        studentName: changingClassStudent.name,
        oldClassId: changingClassStudent.class_id,
        newClassId: newClassId
      });

      // Update student's class (trigger automático registrará no histórico)
      const { data, error: updateError } = await supabase
        .from('students')
        .update({ class_id: newClassId })
        .eq('id', changingClassStudent.id)
        .select();

      if (updateError) {
        console.error('❌ Erro detalhado ao mudar turma:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        toast.error(`Error mudar aluno de turma: ${updateError.message}`);
        return;
      }

      console.log('✅ Mudança de turma bem-sucedida:', data);
      toast.success('Student transferido de turma com sucesso!');
      setShowChangeClassModal(false);
      setChangingClassStudent(null);
      setNewClassId('');
      if (user?.institution_id) {
        await fetchStudents(user.institution_id);
      }
    } catch (error) {
      console.error('❌ Erro excepcional ao mudar turma:', error);
      toast.error(`Error mudar aluno de turma: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const downloadCSVTemplate = () => {
    const csvContent = 
      "João Silva,2024001\n" +
      "Maria Santos,2024002\n" +
      "Pedro Oliveira,";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_alunos.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar extensão
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
      toast.error('Formato não suportado. Use apenas .csv, .xlsx ou .xls');
      return;
    }

    // Se for Excel mas extensão errada, mostrar dica
    if (['xlsx', 'xls'].includes(fileExtension || '')) {
      // Processar Excel
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converter para JSON
        const jsonDate = XLSX.utils.sheet_to_json(worksheet, {
          header: ['name', 'registration_number'],
          defval: '',
          raw: false
        });

        const parsedDate: ImportDate[] = (jsonDate as XlsxRow[])
          .filter((row: XlsxRow, index) => {
            // Pular primeira linha se parecer cabeçalho
            if (index === 0 && (row.name?.toLowerCase().includes('nome') || row.name?.toLowerCase().includes('name'))) {
              return false;
            }
            return row.name && row.name.trim();
          })
          .map((row: XlsxRow) => ({
            name: row.name?.toString().trim() || '',
            registration_number: row.registration_number?.toString().trim() || '',
          }));

        setPreviewDate(parsedDate);
        
        // Validar dados após carregar
        if (parsedDate.length > 0) {
          validateImportDate(parsedDate);
        }
      };
      
      reader.readAsArrayBuffer(file);
    } else {
      // Processar CSV
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          toast.error('Arquivo vazio');
          return;
        }

        // Skip header if present
        const dataLines = lines[0].toLowerCase().includes('nome') || lines[0].toLowerCase().includes('name') ? lines.slice(1) : lines;
        
        const parsedDate: ImportDate[] = dataLines.map((line) => {
          const columns = line.split(/[,;]/).map(col => col.trim().replace(/"/g, ''));
          
          if (columns.length < 1) {
            return {
              name: '',
              error: 'Linha inválida'
            };
          }

          return {
            name: columns[0] || '',
            registration_number: columns[1] || '',
          };
        }).filter(item => item.name);

        setPreviewDate(parsedDate);
        
        // Validar dados após carregar
        if (parsedDate.length > 0) {
          validateImportDate(parsedDate);
        }
      };

      reader.readAsText(file);
    }
  };

  const validateImportDate = async (data: ImportDate[]) => {
    if (!user) return;
    
    setIsValidatingDate(true);
    
    try {
      // Search todas as matrículas existentes com informações dos alunos e turmas
      const { data: existingStudents } = await supabase
        .from('students')
        .select(`
          registration_number,
          name,
          classes!inner(name)
        `)
        .eq('institution_id', user.institution_id);

      const existingMatriculasMap = new Map(
        existingStudents?.map((s: StudentWithClass) => [s.registration_number, {
          name: s.name,
          className: Array.isArray(s.classes) ? s.classes[0]?.name || 'Sem turma' : s.classes?.name || 'Sem turma'
        }]) || []
      );

      // Validar cada item dos dados
      const validatedDate = data.map(item => {
        if (item.registration_number && existingMatriculasMap.has(item.registration_number)) {
          const existing = existingMatriculasMap.get(item.registration_number)!;
          return {
            ...item,
            hasError: true,
            errorMessage: `Registration ${item.registration_number} já pertence ao aluno &apos;${existing.name}&apos; da turma &apos;${existing.className}&apos;`
          };
        }
        return { ...item, hasError: false };
      });

      setPreviewDate(validatedDate);
    } catch (error) {
      console.error('Error validar dados:', error);
    } finally {
      setIsValidatingDate(false);
    }
  };

  const handleImportStudents = async () => {
    if (!user || !importClassId || previewDate.length === 0) {
      toast.error('Select uma turma e carregue dados válidos');
      return;
    }

    try {
      // Search todas as matrículas existentes com informações completas
      const { data: existingStudents } = await supabase
        .from('students')
        .select(`
          registration_number,
          name,
          classes!inner(name)
        `)
        .eq('institution_id', user.institution_id);

      const existingMatriculasMap = new Map(
        existingStudents?.map((s: StudentWithClass) => [s.registration_number, {
          name: s.name,
          className: Array.isArray(s.classes) ? s.classes[0]?.name || 'Sem turma' : s.classes?.name || 'Sem turma'
        }]) || []
      );

      const existingMatriculas = new Set(existingMatriculasMap.keys());

      const studentsToImport: StudentToImport[] = [];
      const duplicateErrors: DuplicateInfo[] = [];
      const generalErrors: string[] = [];
      const studentsWithoutMatricula = previewDate.filter(item => !item.registration_number?.trim() && !item.hasError);
      
      // Gerar matrículas únicas para alunos sem matrícula
      const generatedMatriculas = studentsWithoutMatricula.length > 0 
        ? await generateUniqueRegistrationNumbers(studentsWithoutMatricula.length, existingMatriculas)
        : [];
      
      let generatedIndex = 0;

      // Processar apenas alunos sem erro
      for (const item of previewDate.filter(item => !item.hasError)) {
        let registrationNumber: string;
        
        if (item.registration_number?.trim()) {
          registrationNumber = item.registration_number.trim();
          
          // Verificar se matrícula já existe
          if (existingMatriculasMap.has(registrationNumber)) {
            const existing = existingMatriculasMap.get(registrationNumber)!;
            duplicateErrors.push({
              studentName: item.name,
              matricula: registrationNumber,
              existingStudentName: existing.name,
              existingClassName: existing.className
            });
            continue;
          }
        } else {
          // Usar matrícula gerada
          registrationNumber = generatedMatriculas[generatedIndex++];
        }
        
        studentsToImport.push({
          name: item.name.trim(),
          registration_number: registrationNumber,
          class_id: importClassId,
          institution_id: user.institution_id || '',
          is_active: true,
        });
        
        // Add à lista local para evitar duplicatas internas
        existingMatriculas.add(registrationNumber);
      }

      let importedCount = 0;
      if (studentsToImport.length > 0) {
        const { data, error } = await supabase
          .from('students')
          .insert(studentsToImport)
          .select();

        if (error) {
          console.error('Error importar alunos:', error);
          generalErrors.push('Erro no banco de dados ao importar alguns alunos');
        } else {
          importedCount = data.length;
        }
      }

      // Preparar resultado
      const result: ImportResult = {
        imported: importedCount,
        errors: generalErrors,
        duplicateMatriculas: duplicateErrors
      };

      setImportResult(result);

      // Mostrar feedback
      if (importedCount > 0) {
        toast.success(`✅ ${importedCount} aluno(s) importado(s) com sucesso!`);
      }
      
      if (duplicateErrors.length > 0) {
        toast.error(`⚠️ ${duplicateErrors.length} aluno(s) não importado(s) (matrículas duplicadas)`);
      }

      if (generalErrors.length > 0) {
        toast.error('❌ Alguns alunos não puderam ser importados');
      }

      if (user?.institution_id) {
        await fetchStudents(user.institution_id);
      }
    } catch (error) {
      console.error('Error importar alunos:', error);
      toast.error('Error importar alunos');
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setPreviewDate([]);
    setImportClassId('');
    setImportResult(null);
    setIsValidatingDate(false);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormDate({
      name: student.name,
      registration_number: student.registration_number,
      class_id: student.class_id,
      is_active: student.is_active,
    });
    setShowModal(true);
  };

  const handleOpenChangeClass = (student: Student) => {
    setChangingClassStudent(student);
    setNewClassId('');
    setShowChangeClassModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      await handleUpdateStudent();
    } else {
      await handleCreateStudent();
    }
  };

  const resetForm = () => {
    setFormDate({
      name: '',
      registration_number: '',
      class_id: '',
      is_active: true,
    });
    setEditingStudent(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    resetForm();
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
                <h1 className="text-2xl font-bold">Gerenciar Students</h1>
                <p className="text-blue-100">{institution.nome}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                Importar Excel
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Student
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <label htmlFor="class-filter" className="text-sm font-medium text-gray-700">
              Filter por turma:
            </label>
            <select
              id="class-filter"
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas as turmas</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
            <div className="text-sm text-gray-500">
              {filteredStudents.length} aluno(s) {selectedClassFilter && `na turma selecionada`}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Students Actives
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {students.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'trash'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🗑️ Trash
              {trashedStudents.length > 0 && (
                <span className="ml-2 bg-orange-100 text-orange-800 py-0.5 px-2.5 rounded-full text-xs font-medium">
                  {trashedStudents.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 mt-6">
        {activeTab === 'active' && (
          <>
            {filteredStudents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedClassFilter ? 'Nenhum aluno na turma selecionada' : 'Nenhum aluno cadastrado'}
            </h3>
            <p className="text-gray-500 mb-6">
              {selectedClassFilter ? 'Select outra turma ou' : 'Comece'} {selectedClassFilter ? 'crie' : 'criando'} seu primeiro aluno
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
            >
              Create New Student
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name do Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{student.registration_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{student.classes?.name || 'Sem turma'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {/* Botão Edit */}
                          <button
                            onClick={() => handleEdit(student)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Edit aluno"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Botão Mudar de Class */}
                          <button
                            onClick={() => handleOpenChangeClass(student)}
                            className="text-purple-600 hover:text-purple-900 transition-colors"
                            title="Mudar de turma"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </button>

                          {/* Botão Trash - Todos podem usar */}
                          <button
                            onClick={() => handleMoveToTrash(student)}
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
                              onClick={() => handleDeleteStudent(student)}
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
          </div>
        )}
          </>
        )}

        {/* Trash Section */}
        {activeTab === 'trash' && (
          <div>
            {/* Info sobre Trash */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-orange-800">
                  <strong>Trash:</strong> Students removidos mas que podem ser restaurados.
                  {user.role === 'master' && <span className="ml-1">Como Master, você pode deletar permanentemente.</span>}
                </span>
              </div>
            </div>

            {trashedStudents.length === 0 ? (
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
                  Students movidos para a lixeira aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Removido em</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {trashedStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.registration_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.classes?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.deleted_at ? new Date(student.deleted_at).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {/* Botão Restore - Todos */}
                            <button
                              onClick={() => handleRestoreFromTrash(student)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                              title="Restore aluno"
                            >
                              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Restore
                            </button>

                            {/* Botão Delete - Apenas Master */}
                            {user.role === 'master' && (
                              <button
                                onClick={() => handleDeleteStudent(student)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                                title="Delete PERMANENTEMENTE"
                              >
                                <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
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
            )}
          </div>
        )}
      </main>

      {/* Create/Edit Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingStudent ? 'Edit Student' : 'New Student'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name Completo *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formDate.name}
                  onChange={(e) => setFormDate({ ...formDate, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Digite o nome completo do aluno"
                  required
                />
              </div>
              <div>
                <label htmlFor="registration" className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Registration
                </label>
                <input
                  type="text"
                  id="registration"
                  value={formDate.registration_number}
                  onChange={(e) => setFormDate({ ...formDate, registration_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Deixe vazio para gerar automaticamente"
                />
              </div>
              <div>
                <label htmlFor="class_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Class *
                </label>
                <select
                  id="class_id"
                  value={formDate.class_id}
                  onChange={(e) => setFormDate({ ...formDate, class_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select uma turma</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formDate.is_active}
                  onChange={(e) => setFormDate({ ...formDate, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Student ativo
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {editingStudent ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Class Modal */}
      {showChangeClassModal && changingClassStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Mudar Student de Class</h3>
              <button
                onClick={() => {
                  setShowChangeClassModal(false);
                  setChangingClassStudent(null);
                  setNewClassId('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Student
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md">
                  {changingClassStudent.name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class Atual
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md">
                  {changingClassStudent.classes?.name || 'Sem turma'}
                </div>
              </div>
              <div>
                <label htmlFor="new_class_id" className="block text-sm font-medium text-gray-700 mb-1">
                  New Class *
                </label>
                <select
                  id="new_class_id"
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a nova turma</option>
                  {classes
                    .filter(c => c.id !== changingClassStudent.class_id)
                    .map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {classItem.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeClassModal(false);
                    setChangingClassStudent(null);
                    setNewClassId('');
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleChangeClass}
                  disabled={!newClassId}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Confirm Mudança
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Importar Students</h3>
              <button
                onClick={closeImportModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {/* Box de Instruções */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <span>📋</span> INSTRUÇÕES PARA IMPORTAÇÃO:
                </h4>
                <div className="space-y-2 text-blue-700">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600">✅</span>
                    <div>
                      <strong>Formatos aceitos:</strong> CSV (.csv), Excel (.xlsx, .xls)
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>📊</span>
                    <div>
                      <strong>Estrutura obrigatória:</strong><br/>
                      Coluna 1: Name do Student<br/>
                      Coluna 2: Registration (opcional - será gerada se vazia)
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>💡</span>
                    <div>
                      <strong>Exemplo de arquivo CSV:</strong><br/>
                      <code className="bg-white px-1 rounded">João Silva,2024001</code><br/>
                      <code className="bg-white px-1 rounded">Maria Santos,2024002</code><br/>
                      <code className="bg-white px-1 rounded">Pedro Oliveira,</code><br/>
                      <code className="bg-white px-1 rounded">Ana Costa,2024004</code>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600">⚠️</span>
                    <div>
                      <strong>Importante:</strong><br/>
                      • Primeira linha deve conter os dados (sem cabeçalho)<br/>
                      • Use vírgula como separador no CSV<br/>
                      • Todos os alunos serão adicionados à turma selecionada<br/>
                      • Students com matrícula duplicada serão ignorados
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <button
                    onClick={downloadCSVTemplate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  >
                    📥 Baixar Modelo CSV
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="import_class" className="block text-sm font-medium text-gray-700 mb-1">
                  Class de Destino *
                </label>
                <select
                  id="import_class"
                  value={importClassId}
                  onChange={(e) => setImportClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a turma para importar</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="csv_file" className="block text-sm font-medium text-gray-700 mb-1">
                  Arquivo CSV/Excel
                </label>
                <input
                  type="file"
                  id="csv_file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formatos aceitos: .csv, .xlsx, .xls
                </p>
              </div>
              
              {previewDate.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">
                      📄 Preview dos Dados ({previewDate.length} aluno{previewDate.length !== 1 ? 's' : ''}):
                    </h4>
                    <div className="flex gap-2">
                      {isValidatingDate && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded flex items-center gap-1">
                          <div className="w-3 h-3 border border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                          Validando...
                        </span>
                      )}
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Primeiros 5 alunos
                      </span>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Registration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewDate.slice(0, 5).map((item, index) => (
                          <tr key={index} className={`border-t ${
                            item.hasError 
                              ? 'bg-red-50' 
                              : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}>
                            <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                            <td className="px-3 py-2">
                              {item.hasError ? (
                                <span className="text-red-600 font-medium">❌ Erro</span>
                              ) : (
                                <span className="text-green-600 font-medium">✅ OK</span>
                              )}
                            </td>
                            <td className={`px-3 py-2 font-medium ${
                              item.hasError ? 'text-red-700' : 'text-gray-900'
                            }`}>
                              {item.name}
                            </td>
                            <td className="px-3 py-2">
                              {item.registration_number ? (
                                <span className={item.hasError ? 'text-red-600' : 'text-gray-600'}>
                                  {item.registration_number}
                                </span>
                              ) : (
                                <span className="italic text-blue-600">será gerada automaticamente</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewDate.length > 5 && (
                      <div className="px-3 py-2 text-gray-500 text-center border-t bg-gray-50 font-medium">
                        ... e mais {previewDate.length - 5} aluno{previewDate.length - 5 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  
                  {/* Mostrar erros encontrados no preview */}
                  {previewDate.some(item => item.hasError) && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                      <h5 className="text-sm font-medium text-red-800 mb-2">❌ Problemas encontrados:</h5>
                      <div className="space-y-1 text-xs">
                        {previewDate
                          .filter(item => item.hasError)
                          .slice(0, 3)
                          .map((item, index) => (
                            <div key={index} className="text-red-700">
                              • <strong>{item.name}</strong>: {item.errorMessage}
                            </div>
                          ))}
                        {previewDate.filter(item => item.hasError).length > 3 && (
                          <div className="text-red-600 font-medium">
                            ... e mais {previewDate.filter(item => item.hasError).length - 3} erro(s)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                    <strong>📝 Confirme os dados antes de importar.</strong> 
                    {previewDate.some(item => item.hasError) 
                      ? ' Apenas alunos sem erro serão importados.'
                      : ' Esta ação adicionará todos os alunos à turma selecionada.'
                    }
                  </div>
                </div>
              )}

              {/* Resultado da Importação */}
              {importResult && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">📊 Resultado da Importação:</h4>
                  <div className="space-y-2">
                    {importResult.imported > 0 && (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded">
                        <span>✅</span>
                        <span className="font-medium">{importResult.imported} aluno(s) importado(s) com sucesso</span>
                      </div>
                    )}
                    {importResult.duplicateMatriculas.length > 0 && (
                      <div className="text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
                        <div className="flex items-center gap-2 mb-3">
                          <span>❌</span>
                          <span className="font-medium">{importResult.duplicateMatriculas.length} aluno(s) não importado(s) (matrículas duplicadas):</span>
                        </div>
                        <div className="space-y-2">
                          {importResult.duplicateMatriculas.map((duplicate, idx) => (
                            <div key={idx} className="bg-white p-2 rounded border border-red-100">
                              <div className="font-medium text-red-800">❌ {duplicate.studentName}</div>
                              <div className="text-xs text-red-600 mt-1">
                                <strong>Motivo:</strong> Registration <code className="bg-red-100 px-1 rounded">{duplicate.matricula}</code> já pertence ao aluno 
                                &apos;<strong>{duplicate.existingStudentName}</strong>&apos; da turma &apos;<strong>{duplicate.existingClassName}</strong>&apos;
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {importResult.errors.length > 0 && (
                      <div className="text-red-700 bg-red-50 px-3 py-2 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <span>❌</span>
                          <span className="font-medium">Erros encontrados:</span>
                        </div>
                        <ul className="text-xs space-y-1 ml-6">
                          {importResult.errors.map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200 font-medium"
                >
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                {!importResult && (
                  <button
                    type="button"
                    onClick={handleImportStudents}
                    disabled={!importClassId || previewDate.length === 0 || isValidatingDate}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors duration-200 font-medium"
                  >
                    {isValidatingDate ? (
                      <>🔄 Validando...</>
                    ) : (
                      <>📤 Importar {previewDate.filter(item => !item.hasError).length} Student{previewDate.filter(item => !item.hasError).length !== 1 ? 's' : ''}
                        {previewDate.some(item => item.hasError) && (
                          <span className="text-purple-200 ml-1">({previewDate.filter(item => item.hasError).length} com erro)</span>
                        )}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}