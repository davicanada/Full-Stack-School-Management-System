// Tipos para o sistema de gestão de ocorrências escolares

export interface User {
  id: string;
  name: string;
  email: string;
  is_active?: boolean;
  // role e institution_id foram removidos do banco - agora vêm de user_institutions
  created_at?: string;
  // Campos do sistema de lixeira
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface Usuario {
  id: string;
  email: string;
  name: string;
  nome?: string; // Para compatibilidade
  // Campos abaixo vêm de user_institutions, não da tabela users
  role: 'master' | 'admin' | 'professor';
  tipo?: 'admin' | 'professor' | 'coordenador'; // Para compatibilidade
  institution_id?: string;
  password_hash?: string;
  created_at: string;
  is_active?: boolean;
  // Campos do sistema de lixeira
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
  // Campos do sistema de lixeira
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
  // Campos do sistema de lixeira
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
  name: string; // Alias para nome
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