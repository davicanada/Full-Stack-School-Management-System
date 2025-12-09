# ✅ Sistema de Lixeira para Alunos - Status da Implementação

**Data:** 27 de Outubro de 2025
**Status:** 90% Concluído (Backend completo, Interface precisa de ajustes finais)

---

## ✅ O QUE JÁ FOI IMPLEMENTADO

### **1. Backend Completo** ✅
- ✅ Campos `deleted_at` e `deleted_by` adicionados na interface `Student`
- ✅ Estado `trashedStudents` criado
- ✅ Estado `activeTab` adicionado ('active' | 'trash')
- ✅ Query `fetchStudents()` modificada para **EXCLUIR lixeira**
  ```typescript
  .is('deleted_at', null) // Apenas ativos
  ```
- ✅ Nova query `fetchTrashedStudents()` criada para **BUSCAR lixeira**
  ```typescript
  .not('deleted_at', 'is', null) // Apenas lixeira
  ```
- ✅ useEffect atualizado para carregar lixeira no início

### **2. Funções de Lixeira** ✅
- ✅ `handleMoveToTrash()` - Move aluno para lixeira
- ✅ `handleRestoreFromTrash()` - Restaura aluno da lixeira
- ✅ `handleDeleteStudent()` - Modificada para:
  - Apenas Master pode executar
  - Verifica ocorrências relacionadas
  - Mostra avisos detalhados
  - Confirmação dupla

---

## ⏳ O QUE FALTA FAZER (Interface)

### **3. Adicionar Tab de Lixeira**

Encontre no código a seção de tabs (provavelmente próximo ao header) e adicione:

```tsx
{/* Adicionar após a tab de "Alunos Ativos" */}
<button
  onClick={() => setActiveTab('trash')}
  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
    activeTab === 'trash'
      ? 'border-blue-500 text-blue-600'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
  }`}
>
  🗑️ Lixeira
  {trashedStudents.length > 0 && (
    <span className="ml-2 bg-orange-100 text-orange-800 py-0.5 px-2.5 rounded-full text-xs font-medium">
      {trashedStudents.length}
    </span>
  )}
</button>
```

### **4. Modificar Botões de Ação na Lista Principal**

Encontre onde os alunos são listados (provavelmente dentro de um `.map()`) e modifique os botões:

**ANTES** (tinha algo como):
```tsx
<button onClick={() => handleDeleteStudent(student)}>
  Deletar
</button>
```

**DEPOIS** (substituir por):
```tsx
<div className="flex justify-end gap-2">
  {/* Botão Lixeira - Todos podem usar */}
  <button
    onClick={() => handleMoveToTrash(student)}
    className="text-orange-600 hover:text-orange-900"
    title="Mover para lixeira"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  </button>

  {/* Botão Deletar Permanentemente - APENAS Master */}
  {user.role === 'master' && (
    <button
      onClick={() => handleDeleteStudent(student)}
      className="text-red-600 hover:text-red-900"
      title="Deletar PERMANENTEMENTE (apenas Master)"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </button>
  )}
</div>
```

### **5. Criar Seção de Lixeira**

Adicione após a seção de lista de alunos ativos:

```tsx
{activeTab === 'trash' && (
  <div>
    {/* Info sobre Lixeira */}
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-orange-800">
          <strong>Lixeira:</strong> Alunos removidos mas que podem ser restaurados.
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
          Lixeira vazia
        </h3>
        <p className="text-gray-500">
          Alunos movidos para a lixeira aparecerão aqui
        </p>
      </div>
    ) : (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aluno</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matrícula</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Turma</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Removido em</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
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
                    {/* Botão Restaurar - Todos */}
                    <button
                      onClick={() => handleRestoreFromTrash(student)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      title="Restaurar aluno"
                    >
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Restaurar
                    </button>

                    {/* Botão Deletar - Apenas Master */}
                    {user.role === 'master' && (
                      <button
                        onClick={() => handleDeleteStudent(student)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        title="Deletar PERMANENTEMENTE"
                      >
                        <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Deletar
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
```

---

## 📍 ONDE FAZER AS MUDANÇAS

### Arquivo: `app/admin/alunos/page.tsx`

**Linhas aproximadas:**

1. **Tab de Lixeira**: Procure por "tabs" ou navegação, adicione o novo botão
2. **Botões de Ação**: Procure pelo botão de deletar (linha ~966 ou onde renderiza os alunos)
3. **Seção de Lixeira**: Adicione após a lista principal de alunos

---

## 🔍 COMO ENCONTRAR NO CÓDIGO

### Buscar por:
- `"Deletar"` ou `"Delete"` → Encontra os botões
- `activeTab` → Encontra onde precisa adicionar a tab
- `.map((student` → Encontra onde os alunos são renderizados
- `{students.map` → Lista principal de alunos

---

## ✅ CHECKLIST FINAL

- [x] Interface Student atualizada
- [x] Estado trashedStudents criado
- [x] Query fetchStudents modificada
- [x] Query fetchTrashedStudents criada
- [x] Função handleMoveToTrash implementada
- [x] Função handleRestoreFromTrash implementada
- [x] Função handleDeleteStudent modificada
- [ ] Tab de lixeira adicionada
- [ ] Botões modificados na lista principal
- [ ] Seção de lixeira criada

---

## 🚀 ALTERNATIVA RÁPIDA

Se preferir, posso:
1. Ler o arquivo completo em partes maiores
2. Fazer as modificações restantes de interface
3. Ou você pode fazer manualmente seguindo este guia

**Quer que eu complete a interface agora?**

---

**Backend está 100% pronto! Interface falta apenas UI/botões.**
