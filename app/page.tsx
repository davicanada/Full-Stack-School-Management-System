'use client';

import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Institution, AdminAccessRequest, TeacherAccessRequest, User } from '@/types';
import { supabase } from '@/lib/supabase/client';

export default function Home() {
  // Estados para controlar os diferentes modais
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  
  // Estados para verificação de email existente
  const [adminEmailChecking, setAdminEmailChecking] = useState(false);
  const [adminExistingUser, setAdminExistingUser] = useState<User | null>(null);
  const [adminNameReadonly, setAdminNameReadonly] = useState(false);
  const [adminEmailMessage, setAdminEmailMessage] = useState('');
  
  const [professorEmailChecking, setProfessorEmailChecking] = useState(false);
  const [professorExistingUser, setProfessorExistingUser] = useState<User | null>(null);
  const [professorNameReadonly, setProfessorNameReadonly] = useState(false);
  const [professorEmailMessage, setProfessorEmailMessage] = useState('');
  
  // Estado para controlar o tipo de solicitação de administrador
  const [adminRequestType, setAdminRequestType] = useState<'nova' | 'existente' | ''>('');
  
  // Estados para loading e institutions
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  
  // Lista de estados brasileiros
  const estadosBrasil = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];
  
  const fetchInstitutions = async () => {
    setLoadingInstitutions(true);
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*');
      
      if (error) {
        throw error;
      }
      
      if (data) {
        setInstitutions(data);
        return data;
      }
      
      return [];
    } catch (error) {
      console.error('Erro ao buscar instituições:', error);
      setInstitutions([]);
      return [];
    } finally {
      setLoadingInstitutions(false);
    }
  };
  


  // Função para lidar com o login
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const email = formData.get('login_email') as string;
    const password = formData.get('login_password') as string;

    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      // Buscar usuário no Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        toast.error('Email ou senha incorretos');
        setLoading(false);
        return;
      }

      // Verificar senha (temporariamente sem hash)
      if (user.password_hash !== password) {
        toast.error('Email ou senha incorretos');
        setLoading(false);
        return;
      }

      // Buscar role e institution do usuário em user_institutions
      const { data: userInstitutions, error: instError } = await supabase
        .from('user_institutions')
        .select('role, institution_id')
        .eq('user_id', user.id);

      if (instError || !userInstitutions || userInstitutions.length === 0) {
        toast.error('Usuário sem permissões. Entre em contato com o administrador.');
        setLoading(false);
        return;
      }

      // Pegar primeiro vínculo (prioridade: master > admin > professor)
      const masterLink = userInstitutions.find(ui => ui.role === 'master');
      const adminLink = userInstitutions.find(ui => ui.role === 'admin');
      const professorLink = userInstitutions.find(ui => ui.role === 'professor');

      const primaryLink = masterLink || adminLink || professorLink || userInstitutions[0];

      // Criar objeto usuário com role e institution_id de user_institutions
      const userWithRole = {
        ...user,
        role: primaryLink.role,
        institution_id: primaryLink.institution_id
      };

      // Login direto baseado no role
      localStorage.setItem('user', JSON.stringify(userWithRole));
      toast.success(`Bem-vindo, ${user.name}!`);
      setShowLoginModal(false);

      // Redirecionar baseado no role
      if (primaryLink.role === 'master') {
        window.location.href = '/master';
      } else if (primaryLink.role === 'admin') {
        window.location.href = '/admin';
      } else if (primaryLink.role === 'professor') {
        window.location.href = '/professor';
      }

    } catch {
      toast.error('Erro interno. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar email existente
  const checkExistingEmail = async (email: string, userType: 'admin' | 'professor') => {
    if (!email || !email.includes('@')) return;
    
    const setChecking = userType === 'admin' ? setAdminEmailChecking : setProfessorEmailChecking;
    const setExistingUser = userType === 'admin' ? setAdminExistingUser : setProfessorExistingUser;
    const setNameReadonly = userType === 'admin' ? setAdminNameReadonly : setProfessorNameReadonly;
    const setEmailMessage = userType === 'admin' ? setAdminEmailMessage : setProfessorEmailMessage;
    
    try {
      setChecking(true);
      setEmailMessage('');
      
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('email', email)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar usuário:', error);
        return;
      }
      
      if (existingUser) {
        // Email já existe - mostrar apenas nome e tornar campo readonly
        setExistingUser(existingUser);
        setNameReadonly(true);
        setEmailMessage(`Email já cadastrado como: ${existingUser.name}`);
        
        // Preencher o campo nome automaticamente
        if (userType === 'admin') {
          const nameField = document.getElementById('admin_nome') as HTMLInputElement;
          if (nameField) nameField.value = existingUser.name;
        } else {
          const nameField = document.getElementById('teacher_nome') as HTMLInputElement;
          if (nameField) nameField.value = existingUser.name;
        }
      } else {
        // Email não existe - manter nome já digitado pelo usuário
        setExistingUser(null);
        setNameReadonly(false);
        setEmailMessage('');

        // NÃO limpar o campo nome - preservar o que o usuário já digitou
      }
    } catch (error) {
      console.error('Erro ao verificar email:', error);
    } finally {
      setChecking(false);
    }
  };

  // Função para resetar verificação de email
  const resetEmailCheck = (userType: 'admin' | 'professor') => {
    const setExistingUser = userType === 'admin' ? setAdminExistingUser : setProfessorExistingUser;
    const setNameReadonly = userType === 'admin' ? setAdminNameReadonly : setProfessorNameReadonly;
    const setEmailMessage = userType === 'admin' ? setAdminEmailMessage : setProfessorEmailMessage;
    
    setExistingUser(null);
    setNameReadonly(false);
    setEmailMessage('');
  };


  // Carregar instituições ao montar o componente
  useEffect(() => {
    fetchInstitutions();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header com nome do sistema */}
      <header className="bg-white dark:bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {/* Ícone da escola */}
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Sistema de Gestão de Ocorrências Escolares
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Controle e acompanhamento de ocorrências acadêmicas
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Título de boas-vindas */}
          <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
            Bem-vindo ao Sistema
          </h2>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Gerencie ocorrências escolares de forma eficiente e organizada. 
            Mantenha o controle total sobre eventos disciplinares, pedagógicos e administrativos.
          </p>

          {/* Botões de ação */}
          <div className="mt-10 flex flex-col lg:flex-row gap-4 justify-center items-center">
            {/* Botão de Login */}
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full lg:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors duration-200 ease-in-out flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Fazer Login
            </button>

            {/* Botão de Solicitar Acesso como Administrador */}
            <button
              onClick={() => setShowAdminModal(true)}
              className="w-full lg:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors duration-200 ease-in-out flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Acesso de Administrador
            </button>

            {/* Botão de Solicitar Acesso como Professor */}
            <button
              onClick={() => setShowTeacherModal(true)}
              className="w-full lg:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors duration-200 ease-in-out flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Acesso de Professor
            </button>
          </div>

          {/* Recursos do sistema */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Registro de Ocorrências
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Registre e acompanhe ocorrências disciplinares, pedagógicas e administrativas
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Relatórios e Análises
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Gere relatórios detalhados e analise tendências comportamentais
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Gestão de Usuários
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Controle de acesso para professores, coordenadores e administradores
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Login */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Login</h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label htmlFor="login_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="login_email"
                  name="login_email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="seu.email@escola.edu.br"
                />
              </div>
              <div>
                <label htmlFor="login_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  id="login_password"
                  name="login_password"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Acesso - Administrador */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Solicitar Acesso - Administrador</h3>
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminRequestType(''); // Reset do tipo quando fecha o modal
                  resetEmailCheck('admin'); // Reset da verificação de email
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleAdminSubmit}>
              {/* Campos básicos */}
              <div>
                <label htmlFor="admin_nome" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="admin_nome"
                  name="admin_nome"
                  required
                  readOnly={adminNameReadonly}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white ${
                    adminNameReadonly 
                      ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' 
                      : ''
                  }`}
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <label htmlFor="admin_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="admin_email"
                    name="admin_email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                    placeholder="seu.email@exemplo.com"
                    onBlur={(e) => {
                      if (e.target.value) {
                        checkExistingEmail(e.target.value, 'admin');
                      } else {
                        resetEmailCheck('admin');
                      }
                    }}
                    onChange={(e) => {
                      if (!e.target.value) {
                        resetEmailCheck('admin');
                      }
                    }}
                  />
                  {adminEmailChecking && (
                    <div className="absolute right-2 top-2">
                      <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {adminEmailMessage && (
                  <div className="mt-2 text-sm text-red-600">
                    {adminEmailMessage}
                  </div>
                )}
              </div>

              {/* Tipo de solicitação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tipo de Solicitação *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="admin_request_type"
                      value="nova"
                      checked={adminRequestType === 'nova'}
                      onChange={(e) => setAdminRequestType(e.target.value as 'nova' | 'existente')}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Criar nova instituição</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="admin_request_type"
                      value="existente"
                      checked={adminRequestType === 'existente'}
                      onChange={(e) => setAdminRequestType(e.target.value as 'nova' | 'existente')}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Administrar instituição existente</span>
                  </label>
                </div>
              </div>

              {/* Campos condicionais para nova instituição */}
              {adminRequestType === 'nova' && (
                <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300">Dados da Nova Instituição</h4>
                  <div>
                    <label htmlFor="instituicao_nome" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome da Instituição *
                    </label>
                    <input
                      type="text"
                      id="instituicao_nome"
                      name="new_institution_name"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Ex: Colégio Dom Pedro II"
                    />
                  </div>
                  <div>
                    <label htmlFor="instituicao_endereco" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Endereço *
                    </label>
                    <input
                      type="text"
                      id="instituicao_endereco"
                      name="new_institution_address"
                      required
                      minLength={5}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                      placeholder="Rua, número, bairro (mínimo 5 caracteres)"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="instituicao_cidade" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cidade *
                      </label>
                      <input
                        type="text"
                        id="instituicao_cidade"
                        name="new_institution_city"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Digite o nome da cidade"
                      />
                    </div>
                    <div>
                      <label htmlFor="instituicao_estado" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Estado *
                      </label>
                      <select
                        id="instituicao_estado"
                        name="new_institution_state"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Selecione</option>
                        {estadosBrasil.map(estado => (
                          <option key={estado} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Campo condicional para instituição existente */}
              {adminRequestType === 'existente' && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-3">Selecionar Instituição</h4>
                  <div>
                    <label htmlFor="instituicao_existente" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Instituição *
                    </label>
                    <select
                      id="instituicao_existente"
                      name="existing_institution_id"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Selecione uma instituição</option>
                      {loadingInstitutions ? (
                        <option disabled>Carregando...</option>
                      ) : (
                        institutions.map(instituicao => (
                          <option key={instituicao.id} value={instituicao.id}>
                            {instituicao.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!adminRequestType || loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {loading ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Acesso - Professor */}
      {showTeacherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Solicitar Acesso - Professor</h3>
              <button
                onClick={() => {
                  setShowTeacherModal(false);
                  resetEmailCheck('professor'); // Reset da verificação de email
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleTeacherSubmit}>
              <div>
                <label htmlFor="teacher_nome" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="teacher_nome"
                  name="professor_name"
                  required
                  readOnly={professorNameReadonly}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white ${
                    professorNameReadonly 
                      ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' 
                      : ''
                  }`}
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <label htmlFor="teacher_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="teacher_email"
                    name="professor_email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                    placeholder="seu.email@escola.edu.br"
                    onBlur={(e) => {
                      if (e.target.value) {
                        checkExistingEmail(e.target.value, 'professor');
                      } else {
                        resetEmailCheck('professor');
                      }
                    }}
                    onChange={(e) => {
                      if (!e.target.value) {
                        resetEmailCheck('professor');
                      }
                    }}
                  />
                  {professorEmailChecking && (
                    <div className="absolute right-2 top-2">
                      <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {professorEmailMessage && (
                  <div className="mt-2 text-sm text-red-600">
                    {professorEmailMessage}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="teacher_instituicao" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Selecionar Instituição *
                </label>
                <select
                  id="teacher_instituicao"
                  name="professor_institution"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Selecione sua instituição</option>
                  {loadingInstitutions ? (
                    <option disabled>Carregando...</option>
                  ) : (
                    institutions.map(instituicao => (
                      <option key={instituicao.id} value={instituicao.id}>
                        {instituicao.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {loading ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </form>
          </div>
        </div>
      )}

      
      {/* Toast notifications */}
      <Toaster position="top-right" />
    </div>
  );

  // Função para lidar com o envio do formulário de administrador
  async function handleAdminSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    
    // Capturar dados básicos do form
    const adminName = adminExistingUser ? adminExistingUser.name : formData.get('admin_nome') as string;
    const adminEmail = formData.get('admin_email') as string;
    const adminType = formData.get('admin_request_type') as string;
    
    // Capturar campos da nova instituição
    const newInstitutionName = formData.get('new_institution_name') as string;
    const newInstitutionAddress = formData.get('new_institution_address') as string;
    const newInstitutionCity = formData.get('new_institution_city') as string;
    const newInstitutionState = formData.get('new_institution_state') as string;
    
    // Capturar instituição existente
    const existingInstitutionId = formData.get('existing_institution_id') as string;
    
    setLoading(true);
    
    try {
      
      // Validação básica
      if (!adminName || !adminEmail) {
        toast.error('Nome e email são obrigatórios');
        setLoading(false);
        return;
      }

      // Validação de email duplicado
      if (adminExistingUser) {
        toast.error('Este email já está cadastrado. Use outro email.');
        setLoading(false);
        return;
      }

      if (!adminType) {
        toast.error('Selecione o tipo de solicitação');
        setLoading(false);
        return;
      }

      // Validação específica baseada no tipo
      if (adminType === 'nova') {
        if (!newInstitutionName || !newInstitutionAddress || !newInstitutionCity || !newInstitutionState) {
          toast.error('Preencha todos os campos da instituição');
          setLoading(false);
          return;
        }
      }

      const requestData: AdminAccessRequest = {
        nome: adminName,
        email: adminEmail,
        tipo: adminType,
      };
      
      if (adminType === 'nova') {
        requestData.nova_instituicao = {
          nome_instituicao: newInstitutionName,
          endereco: newInstitutionAddress,
          cidade: newInstitutionCity,
          estado: newInstitutionState,
        };
      } else if (adminType === 'existente') {
        if (!existingInstitutionId) {
          toast.error('Selecione uma instituição');
          setLoading(false);
          return;
        }
        
        requestData.institution_id = existingInstitutionId;
      } else {
        toast.error('Tipo de solicitação inválido');
        setLoading(false);
        return;
      }
      
      const payloadToSend = {
        nome: requestData.nome,
        email: requestData.email,
        tipo: 'admin',
        request_type: adminType === 'nova' ? 'admin_new' : 'admin_existing',
        institution_id: requestData.institution_id,
        is_existing_user: !!adminExistingUser,
        existing_user_id: adminExistingUser?.id || null,
        nova_instituicao: requestData.nova_instituicao,
        new_institution_name: newInstitutionName,
        new_institution_address: newInstitutionAddress,
        new_institution_city: newInstitutionCity,
        new_institution_state: newInstitutionState,
      };
      
      const response = await fetch('/api/access-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadToSend),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success('Solicitação enviada com sucesso!');
        setShowAdminModal(false);
        setAdminRequestType('');
        resetEmailCheck('admin');
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error(result.error || 'Erro ao enviar solicitação');
      }
    } catch {
      toast.error('Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  }
  
  // Função para lidar com o envio do formulário de professor
  async function handleTeacherSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    
    const professorName = professorExistingUser ? professorExistingUser.name : formData.get('professor_name');
    const professorEmail = formData.get('professor_email');
    const professorInstitution = formData.get('professor_institution');
    
    try {
      // Validação
      if (!professorName || !professorEmail || !professorInstitution) {
        toast.error('Preencha todos os campos obrigatórios');
        setLoading(false);
        return;
      }

      // Validação de email duplicado
      if (professorExistingUser) {
        toast.error('Este email já está cadastrado. Use outro email.');
        setLoading(false);
        return;
      }

      const requestData: TeacherAccessRequest = {
        nome: professorName as string,
        email: professorEmail as string,
        institution_id: professorInstitution as string,
      };
      
      const response = await fetch('/api/access-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: requestData.nome,
          email: requestData.email,
          tipo: 'professor',
          request_type: 'professor',
          institution_id: requestData.institution_id,
          is_existing_user: !!professorExistingUser,
          existing_user_id: professorExistingUser?.id || null,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success('Solicitação enviada com sucesso!');
        setShowTeacherModal(false);
        resetEmailCheck('professor');
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error(result.error || 'Erro ao enviar solicitação');
      }
    } catch {
      toast.error('Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  }
}
