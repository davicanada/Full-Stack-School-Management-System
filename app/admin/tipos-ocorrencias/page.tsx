'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Usuario, Institution } from '@/types';
import toast, { Toaster } from 'react-hot-toast';

type Severity = 'leve' | 'moderada' | 'grave';

interface OccurrenceType {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  is_active: boolean;
  institution_id: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  occurrenceCount?: number;
}

interface OccurrenceTypeFormDate {
  name: string;
  description: string;
  severity: Severity;
  is_active: boolean;
}

interface DefaultType {
  name: string;
  description: string;
  severity: Severity;
}

export default function TypesOcorrenciasPage() {
  const router = useRouter();
  const [user, setUser] = useState<Usuario | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [occurrenceTypes, setOccurrenceTypes] = useState<OccurrenceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showDefaultTypesModal, setShowDefaultTypesModal] = useState(false);

  // Form states
  const [editingType, setEditingType] = useState<OccurrenceType | null>(null);
  const [editingTypeHasOccurrences, setEditingTypeHasOccurrences] = useState(false);
  const [formDate, setFormDate] = useState<OccurrenceTypeFormDate>({
    name: '',
    description: '',
    severity: 'leve',
    is_active: true,
  });

  // Default types selection
  const [selectedDefaultTypes, setSelectedDefaultTypes] = useState<string[]>([]);

  const defaultTypes: DefaultType[] = [
    { name: 'Atraso', description: 'Chegada após o horário estabelecido', severity: 'leve' },
    { name: 'Falta sem justificativa', description: 'Ausência não justificada às aulas', severity: 'moderada' },
    { name: 'No fez tarefa', description: 'Deixou de entregar atividade solicitada', severity: 'leve' },
    { name: 'Uso de celular', description: 'Uso inadequado de aparelho celular durante as aulas', severity: 'leve' },
    { name: 'Comportamento inadequado', description: 'Comportamento que perturba o ambiente escolar', severity: 'moderada' },
    { name: 'Desrespeito ao professor', description: 'Atitudes desrespeitosas direcionadas ao educador', severity: 'grave' },
    { name: 'Agressão física', description: 'Atos de violência física contra colegas ou funcionários', severity: 'grave' }
  ];

  const fetchOccurrenceTypes = useCallback(async (institutionId: string, inTrash: boolean = false) => {
      try {
        // Search tipos de ocorrências
        let query = supabase
          .from('occurrence_types')
          .select('*')
          .eq('institution_id', institutionId);

        // Filter por status de lixeira
        if (inTrash) {
          query = query.not('deleted_at', 'is', null);
        } else {
          query = query.is('deleted_at', null);
        }

        const { data: types, error: typesError } = await query.order('name');

        if (typesError) {
          console.error('Error buscar tipos de ocorrências:', typesError);
          toast.error('Error carregar tipos de ocorrências');
          return;
        }

        // Para cada tipo, buscar quantidade de ocorrências
        const typesWithCount = await Promise.all(
          (types || []).map(async (type) => {
            const { count } = await supabase
              .from('occurrences')
              .select('*', { count: 'exact', head: true })
              .eq('occurrence_type_id', type.id);

            return {
              ...type,
              occurrenceCount: count || 0
            };
          })
        );

        setOccurrenceTypes(typesWithCount);
      } catch (error) {
        console.error('Error buscar tipos de ocorrências:', error);
        toast.error('Error carregar tipos de ocorrências');
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

        if (userDate.institution_id) await fetchOccurrenceTypes(userDate.institution_id);
      } catch (error) {
        console.error('Erro na autenticação:', error);
        toast.error('Error verificar autenticação');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, fetchOccurrenceTypes]);

  // Refetch when trash view changes
  useEffect(() => {
    if (user?.institution_id) {
      fetchOccurrenceTypes(user.institution_id, showTrash);
    }
  }, [showTrash, user, fetchOccurrenceTypes]);

  

  const handleUpdateType = async () => {
    if (!user || !editingType) return;

    try {
      if (!formDate.name.trim() || !formDate.description.trim()) {
        toast.error('Name e descrição são obrigatórios');
        return;
      }

      // Se tem ocorrências, verificar se está tentando mudar nome ou descrição
      if (editingTypeHasOccurrences) {
        if (formDate.name.trim() !== editingType.name || formDate.description.trim() !== editingType.description) {
          toast.error('No é possível alterar o nome ou descrição de um tipo que já possui ocorrências registradas. Você só pode alterar a severidade.');
          return;
        }
      }

      // Verificar se já existe tipo com o mesmo nome (excluindo o atual)
      const { data: existingType } = await supabase
        .from('occurrence_types')
        .select('id')
        .eq('name', formDate.name.trim())
        .eq('institution_id', user.institution_id)
        .neq('id', editingType.id)
        .single();

      if (existingType) {
        toast.error('Já existe um tipo de ocorrência com este nome');
        return;
      }

      const { error } = await supabase
        .from('occurrence_types')
        .update({
          name: formDate.name.trim(),
          description: formDate.description.trim(),
          severity: formDate.severity,
          is_active: formDate.is_active,
        })
        .eq('id', editingType.id);

      if (error) {
        console.error('Error atualizar tipo de ocorrência:', error);
        toast.error('Error atualizar tipo de ocorrência');
        return;
      }

      toast.success('Type de ocorrência updated successfully!');
      setShowModal(false);
      setEditingType(null);
      setEditingTypeHasOccurrences(false);
      resetForm();
      if (user.institution_id) await fetchOccurrenceTypes(user.institution_id, showTrash);
    } catch (error) {
      console.error('Error atualizar tipo de ocorrência:', error);
      toast.error('Error atualizar tipo de ocorrência');
    }
  };

  const handleCreateType = async () => {
    if (!user) return;

    try {
      if (!formDate.name.trim() || !formDate.description.trim()) {
        toast.error('Name e descrição são obrigatórios');
        return;
      }

      // Verificar se já existe tipo com o mesmo nome
      const { data: existingType } = await supabase
        .from('occurrence_types')
        .select('id')
        .eq('name', formDate.name.trim())
        .eq('institution_id', user.institution_id || '')
        .single();

      if (existingType) {
        toast.error('Já existe um tipo de ocorrência com este nome');
        return;
      }

      const { error } = await supabase
        .from('occurrence_types')
        .insert({
          name: formDate.name.trim(),
          description: formDate.description.trim(),
          severity: formDate.severity,
          is_active: formDate.is_active,
          institution_id: user.institution_id || '',
        });

      if (error) {
        throw error;
      }

      toast.success('Type de ocorrência created successfully!');
      setShowModal(false);
      resetForm();
      if (user.institution_id) await fetchOccurrenceTypes(user.institution_id, showTrash);
    } catch (error) {
      console.error('Error criar tipo de ocorrência:', error);
      toast.error('Error criar tipo de ocorrência');
    }
  };

  const handleToggleStatus = async (type: OccurrenceType) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('occurrence_types')
        .update({ is_active: !type.is_active })
        .eq('id', type.id);

      if (error) {
        console.error('Error alterar status:', error);
        toast.error('Error alterar status do tipo');
        return;
      }

      toast.success(`Type ${!type.is_active ? 'ativado' : 'desativado'} com sucesso!`);
      if (user.institution_id) await fetchOccurrenceTypes(user.institution_id, showTrash);
    } catch (error) {
      console.error('Error alterar status:', error);
      toast.error('Error alterar status do tipo');
    }
  };

  const handleMoveToTrash = async (type: OccurrenceType) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('occurrence_types')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          is_active: false
        })
        .eq('id', type.id);

      if (error) {
        console.error('Error mover para lixeira:', error);
        toast.error('Error mover tipo para a lixeira');
        return;
      }

      toast.success(`${type.name} foi movido para a lixeira e desativado`);
      if (user.institution_id) await fetchOccurrenceTypes(user.institution_id, showTrash);
    } catch (error) {
      console.error('Error mover para lixeira:', error);
      toast.error('Error mover tipo para a lixeira');
    }
  };

  const handleRestoreFromTrash = async (type: OccurrenceType) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('occurrence_types')
        .update({
          deleted_at: null,
          deleted_by: null,
          is_active: true
        })
        .eq('id', type.id);

      if (error) {
        console.error('Error restaurar:', error);
        toast.error('Error restaurar tipo');
        return;
      }

      toast.success(`${type.name} foi restaurado e reativado com sucesso`);
      if (user.institution_id) await fetchOccurrenceTypes(user.institution_id, showTrash);
    } catch (error) {
      console.error('Error restaurar:', error);
      toast.error('Error restaurar tipo');
    }
  };

  const handlePermanentDelete = async (type: OccurrenceType) => {
    if (!user) return;

    // Verificar se há ocorrências usando este tipo
    const { data: occurrences } = await supabase
      .from('occurrences')
      .select('id')
      .eq('occurrence_type_id', type.id);

    if (occurrences && occurrences.length > 0) {
      toast.error(`No é possível excluir permanentemente. Existem ${occurrences.length} ocorrência(s) registrada(s) com este tipo.`);
      return;
    }

    const confirmed = window.confirm(
      `⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nDeseja realmente excluir permanentemente o tipo "${type.name}"?\n\nEsta ação NÃO PODE ser desfeita.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('occurrence_types')
        .delete()
        .eq('id', type.id);

      if (error) {
        console.error('Error deletar tipo:', error);
        toast.error('Error deletar tipo de ocorrência');
        return;
      }

      toast.success('Type de ocorrência excluído permanentemente!');
      if (user.institution_id) await fetchOccurrenceTypes(user.institution_id, showTrash);
    } catch (error) {
      console.error('Error deletar tipo:', error);
      toast.error('Error deletar tipo de ocorrência');
    }
  };

  const handleAddDefaultTypes = async () => {
    if (!user || selectedDefaultTypes.length === 0) {
      toast.error('Select pelo menos um tipo padrão');
      return;
    }

    try {
      const typesToAdd = defaultTypes.filter(type => 
        selectedDefaultTypes.includes(type.name)
      );

      // Verificar se algum tipo já existe
      const { data: existingTypes } = await supabase
        .from('occurrence_types')
        .select('name')
        .eq('institution_id', user.institution_id)
        .in('name', typesToAdd.map(t => t.name));

      const existingNames = existingTypes?.map(t => t.name) || [];
      const newTypes = typesToAdd.filter(type => !existingNames.includes(type.name));

      if (newTypes.length === 0) {
        toast.error('Todos os tipos selecionados já existem');
        return;
      }

      const { error } = await supabase
        .from('occurrence_types')
        .insert(
          newTypes.map(type => ({
            name: type.name,
            description: type.description,
            severity: type.severity,
            is_active: true,
            institution_id: user.institution_id,
          }))
        );

      if (error) {
        console.error('Error adicionar tipos padrão:', error);
        toast.error('Error adicionar tipos padrão');
        return;
      }

      toast.success(`${newTypes.length} tipo(s) padrão adicionado(s) com sucesso!`);
      setShowDefaultTypesModal(false);
      setSelectedDefaultTypes([]);
      if (user.institution_id) await fetchOccurrenceTypes(user.institution_id, showTrash);
    } catch (error) {
      console.error('Error adicionar tipos padrão:', error);
      toast.error('Error adicionar tipos padrão');
    }
  };

  const handleEdit = (type: OccurrenceType) => {
    setEditingType(type);
    setEditingTypeHasOccurrences((type.occurrenceCount || 0) > 0);
    setFormDate({
      name: type.name,
      description: type.description,
      severity: type.severity,
      is_active: type.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingType) {
      await handleUpdateType();
    } else {
      await handleCreateType();
    }
  };

  const resetForm = () => {
    setFormDate({
      name: '',
      description: '',
      severity: 'leve',
      is_active: true,
    });
    setEditingType(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingType(null);
    setEditingTypeHasOccurrences(false);
    resetForm();
  };

  const getSeverityColor = (severity: Severity) => {
    switch (severity) {
      case 'leve': return 'bg-green-100 text-green-800';
      case 'moderada': return 'bg-yellow-100 text-yellow-800';
      case 'grave': return 'bg-red-100 text-red-800';
    }
  };

  const getSeverityLabel = (severity: Severity) => {
    switch (severity) {
      case 'leve': return 'Leve';
      case 'moderada': return 'Moderada';
      case 'grave': return 'Grave';
    }
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
                <h1 className="text-2xl font-bold">Types de Occurrences</h1>
                <p className="text-blue-100">{institution.nome}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTrash(!showTrash)}
                className={`${
                  showTrash
                    ? 'bg-gray-600 hover:bg-gray-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                } px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2`}
                title={showTrash ? 'Ver tipos ativos' : 'Ver lixeira'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showTrash ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  )}
                </svg>
                {showTrash ? 'Back' : 'Trash'}
              </button>
              {!showTrash && (
                <>
                  <button
                    onClick={() => setShowDefaultTypesModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Add Types Padrão
                  </button>
                  <button
                    onClick={() => setShowModal(true)}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Type
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Info text */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p className="text-gray-600">
          Defina os tipos de ocorrências que podem ser registradas em sua instituição
        </p>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {occurrenceTypes.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum tipo de ocorrência cadastrado
            </h3>
            <p className="text-gray-500 mb-6">
              Comece criando tipos de ocorrências para sua instituição
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
              >
                Create New Type
              </button>
              <button
                onClick={() => setShowDefaultTypesModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
              >
                Usar Types Padrão
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severidade
                    </th>
                    {!showTrash && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Occurrences
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {occurrenceTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{type.name}</div>
                          <div className="text-sm text-gray-500">{type.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(type.severity)}`}>
                          {getSeverityLabel(type.severity)}
                        </span>
                      </td>
                      {!showTrash && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              type.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {type.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {type.occurrenceCount || 0} ocorrência(s)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {showTrash ? (
                            <>
                              <button
                                onClick={() => handleRestoreFromTrash(type)}
                                className="text-green-600 hover:text-green-900 transition-colors"
                                title="Restore tipo"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handlePermanentDelete(type)}
                                className="text-red-600 hover:text-red-900 transition-colors"
                                title="Delete permanentemente"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(type)}
                                className="text-blue-600 hover:text-blue-900 transition-colors"
                                title="Edit tipo"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleToggleStatus(type)}
                                className={`${type.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} transition-colors`}
                                title={type.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {type.is_active ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636 5.636 18.364" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => handleMoveToTrash(type)}
                                className="text-orange-600 hover:text-orange-900 transition-colors"
                                title="Mover para lixeira"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
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
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingType ? 'Edit Type de Occurrence' : 'New Type de Occurrence'}
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
            {editingType && editingTypeHasOccurrences && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 mb-1">Edição Restrita</h4>
                    <p className="text-sm text-yellow-700">
                      Este tipo possui <strong>{editingType.occurrenceCount} ocorrência(s)</strong> registrada(s).
                      Por questões de integridade histórica, você não pode alterar o nome ou descrição.
                      Apenas a severidade pode ser modificada.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formDate.name}
                  onChange={(e) => setFormDate({ ...formDate, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Ex: Atraso, Indisciplina"
                  disabled={editingType && editingTypeHasOccurrences}
                  required
                />
                {editingType && editingTypeHasOccurrences && (
                  <p className="text-xs text-gray-500 mt-1">Campo bloqueado - tipo possui ocorrências registradas</p>
                )}
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  id="description"
                  value={formDate.description}
                  onChange={(e) => setFormDate({ ...formDate, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  rows={3}
                  placeholder="Descreva o tipo de ocorrência..."
                  disabled={editingType && editingTypeHasOccurrences}
                  required
                />
                {editingType && editingTypeHasOccurrences && (
                  <p className="text-xs text-gray-500 mt-1">Campo bloqueado - tipo possui ocorrências registradas</p>
                )}
              </div>
              <div>
                <label htmlFor="severity" className="block text-sm font-medium text-gray-700 mb-1">
                  Severidade *
                </label>
                <select
                  id="severity"
                  value={formDate.severity}
                  onChange={(e) => setFormDate({ ...formDate, severity: e.target.value as Severity })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="leve">Leve</option>
                  <option value="moderada">Moderada</option>
                  <option value="grave">Grave</option>
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
                  Type ativo
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
                  {editingType ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Default Types Modal */}
      {showDefaultTypesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Types Padrão</h3>
              <button
                onClick={() => setShowDefaultTypesModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Select os tipos de ocorrências padrão que deseja adicionar à sua instituição:
            </p>
            <div className="space-y-3">
              {defaultTypes.map((type) => (
                <div key={type.name} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    id={`default-${type.name}`}
                    checked={selectedDefaultTypes.includes(type.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDefaultTypes([...selectedDefaultTypes, type.name]);
                      } else {
                        setSelectedDefaultTypes(selectedDefaultTypes.filter(name => name !== type.name));
                      }
                    }}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <label htmlFor={`default-${type.name}`} className="text-sm font-medium text-gray-900 cursor-pointer">
                        {type.name}
                      </label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(type.severity)}`}>
                        {getSeverityLabel(type.severity)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{type.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-6">
              <button
                type="button"
                onClick={() => {
                  setShowDefaultTypesModal(false);
                  setSelectedDefaultTypes([]);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddDefaultTypes}
                disabled={selectedDefaultTypes.length === 0}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Add {selectedDefaultTypes.length} Type(s)
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}