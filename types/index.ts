// Types for the system de gestão de ocorrências escolares

export interface User {
  id: string;
  name: string;
  email: string;
  is_active?: boolean;
  // role and institution_id were removed from database - agora vêm de user_institutions
  created_at?: string;
  // Trash system fields
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface Usuario {
  id: string;
  email: string;
  name: string;
  nome?: string; // For compatibility
  // Fields below come from user_institutions, não da tabela users
  role: 'master' | 'admin' | 'professor';
  tipo?: 'admin' | 'professor' | 'coordenador'; // For compatibility
  institution_id?: string;
  password_hash?: string;
  created_at: string;
  is_active?: boolean;
  // Trash system fields
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  created_at: string;
  is_active: boolean;
  institution_id?: string;
  userInstitutionId?: string;
  classCount?: number;
  occurrenceCount?: number;
  // Trash system fields
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface Student {
  id: string;
  name: string;
  email?: string;
  institution_id: string;
  class_id?: string;
  is_active: boolean;
  created_at: string;
  // Trash system fields
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface Ocorrencia {
  id: string;
  aluno_nome: string;
  aluno_turma: string;
  tipo_ocorrencia: 'disciplinar' | 'pedagogica' | 'administrativa';
  descricao: string;
  professor_id: string;
  data_ocorrencia: string;
  status: 'aberta' | 'em_andamento' | 'resolvida';
  created_at: string;
  updated_at: string;
}

export interface Institution {
  id: string;
  nome: string;
  name: string; // Alias for nome
  endereco?: string;
  cidade?: string;
  estado?: string;
  ativa: boolean;
  created_at: string;
}

export interface AccessRequest {
  id: string;
  nome: string;
  email: string;
  tipo: 'admin' | 'professor';
  institution_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface AdminAccessRequest {
  nome: string;
  email: string;
  tipo: 'nova' | 'existente';
  institution_id?: string;
  nova_instituicao?: {
    nome_instituicao: string;
    endereco: string;
    cidade: string;
    estado: string;
  };
}

export interface TeacherAccessRequest {
  nome: string;
  email: string;
  institution_id: string;
}